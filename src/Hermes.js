import pathToRegexp from 'path-to-regexp'

import Emitter from '@freshlysqueezedgames/emitter'

import Action from './Action'
import Reducer from './Reducer'
import Route from './Route'
import Events from './Events'

const {toString, hasOwnProperty} = Object.prototype
const instances: Object = {}

/**
 * #TODO: Replace socket.io with websockets (5x faster)
 * #TODO: Get subscriptions being triggered by submitted actions
 * #TODO: Have update stage (triggered by function call) with resulting full-sweep update
 * #TOOD: Allow for a general UPDATE action on all reducers, allowing for specific branches to update based on server triggers
 * @param {*} props 
 */
function Hermes (props: Object) {
  if (!props || !props.name) {
    throw new Error('all Hermes instances must have a unique name ({name : [YOUR NAME]}) to be able to recover them globally')
  }

  let instance: Hermes

  const HERMES_EVENTS: Object = {
    UPDATE: 'hermesevents.update'
  }

  // Each hermes instance has a private store that is used to manage a state heap.
  const Store: Object = Object.create(null)

  /**
   * Stores path information in a searchable heap
   */
  const paths: Object = Object.create(null)
  const pathEnds: Array = [] // We can more efficiently trace paths by working from the leaves to the root

  const reducers: Object = Object.create(null)
  const reducerEnds: Array = []

  const reducer: Reducer = new Reducer()

  reducer.Events = function () {
    return Events
  }

  /** 
   * @class Hermes
   * @description This singleton manages stores in the context of a external data source and marries the paths not only to the urls for the server,
   * but for the object traversal itself. Making it possible to listen for changes to data at any specific point in a heap. As any flux design, actions
   * trigger changes in the Store (including from the server) and views can subscribe to object changes in the heap(s)
  */
  class Hermes {
    constructor (props: Object) {
      if (instance) {
        throw new Error('Hermes already exists, please use Hermes.Instance() to get the singleton')
      }

      if (props.paths) {
        props.paths = OrderByLongest(props.paths)

        for (let key in props.paths) {
          let config: any = new Route(key, props.paths[key])

          const current: Object = Branch(paths, key.split('/'), (node : Object, step : string, i : number) => {
            node.step = step

            node.position = i + 1

            return node
          }, true)

          pathEnds.push(current)
          current.config = config
        }
      } else if (props.verbose) {
        console.warn('No paths have been defined for the instance: ', props.name, 'this means no data will be pulled from the server')
      }

      if (props.reducers) {
        props.reducers = OrderByLongest(props.reducers)

        for (let key in props.reducers) {
          const reducer: Reducer = props.reducers[key]

          if (!(reducer instanceof Reducer)) {
            throw new Error('Property at path: ', key, ' is not a Reducer instance!')
          }

          // Bind a function for accessing the events list. There is one list per Hermes.
          reducer.Events = function () {
            return Events
          }

          const current: Object = Branch(reducers, key.split('/'), (node, step, i) => {
            node.step = step
            node.position = i + 1

            return node
          }, true)

          reducerEnds.push(current)

          current.reducer = reducer
          reducer.path = key
        }
      } else if (props.verbose) {
        console.warn('No reducers have been defined for the instance, this means all data will be copied as submitted in action payloads: ', props.name)
      }

      const t: Hermes = this
      
      t.verbose = props.verbose || false
      t.paths = props.paths || false
    }

    static Instance (props?: Object): Hermes {
      return instance || new Hermes(props)
    }

    Subscribe (name: string, callback: Function, context : string, projection: Object): Hermes {
      const t: Hermes = this

      if (!name || typeof name !== 'string' || toString.call(callback) !== '[object Function]') {
        console.warn('you must always call Subscribe with a string path and a callback function', name, callback)
        return t
      }

      // if (!subscriptions[path]) { // TODO: This needs to be a callback, promises are done once resolve is called.
      //   const group : Array = subscriptions[path] = []
        
      //   group.keys = []
      //   group.regex = pathToRegexp(path, group.keys)
      //   group.ToPath = pathToRegexp.compile(path)
      // }

      for (let key in projection) {
        projection[key] = projection[key].split('/')
      }

      Events.Subscribe(name, callback, context, projection)

      return t
    }

    Do (action: Action): Promise {
      const t: Hermes = this

      if (!(action instanceof Action)) {
        throw new Error('Parameter 1 must be an Action instance', action)
      }

      // We look at the instance, and determine our path based on the reducer instance associated with the action
      let i: number = reducerEnds.length
      let path: string
      const reducer: Reducer = action.Reducer()

      // Match the reducer
      while (i--) {
        const reducerEnd: Reducer = reducerEnds[i].reducer

        if (reducer === reducerEnd) {
          path = reducerEnd.path

          // notify reducer of submission
          reducerEnd.Submission(action)
          break
        }
      }

      // one time call for the first request of the data
      return Query.call(t, pathToRegexp.compile(path)(action.context), action)
    }

    Print () {
      console.log('this is the store', Store)
    }
  }

  /**
   * This looks at the paths and determines which is the closest match, working from 
   * the leaves downwards
   * @param {*} steps 
   */
  function Trace (steps: Array, ends: Array = pathEnds) {
    const t: Hermes = this

    let i: number = -1
    const l: number = ends.length

    let requestPath: Array
    let closestPath: Array

    let result: Object

    while (++i < l) {
      let end: Object = ends[i]

      if (end.position !== steps.length) { // the path must be the same length
        continue
      }

      let j: number = steps.length

      while (j--) {
        const step: string = steps[j]

        if (end.position === j + 1 && end.step !== step && end.step[0] !== ':') {
          break
        }

        if (end.position === j + 1) {
          end = end.parent
        }
      }

      if (j === -1) {
        end = ends[i]

        result = end
        closestPath = [end.step]

        while ((end = end.parent) && end.step) {
          closestPath.unshift(end.step)
        }

        requestPath = steps.slice(0, closestPath.length)

        break
      }
    }

    return {
      requestPath,
      result
    }
  }

  function Query (path: string, action: Action): Promise {
    const t: Hermes = this

    if (t.verbose) {
      console.log('getting this path!', path)
    }

    return new Promise((resolve: Function, reject: Function) => {
      const steps: Array = path.split('/')
      const {requestPath, result} = Trace.call(t, steps)

      const OnApply: Function = (payload: Object = Object.create(null)) => {
        action.payload = payload // Override the payload with the new one given

        // Update the store, and ensure that the new state is in place.
        Update.call(t, steps, action)

        // This part, working in parent-first left-to-right, we should trigger any subscribers at each path within the CHANGED heap.
        //Publish.call(t, steps, action)
        Events.Dispatch()

        resolve && resolve()
      }

      if (!requestPath) {
        // this is not a requestable piece of data!
        OnApply(action.payload)
        return
      }

      steps.splice(requestPath.length)

      if (t.verbose) {
        console.log('requesting this path!', requestPath.join('/'))
      }

      // We need to be able to deviate here based on the type of request. Either it will follow a REST style system or GraphQL style system
      // http://127.0.0.1:3000/arc?query=%23%20Welcome%20to%20GraphiQL%0A%23%0A%23%20GraphiQL%20is%20an%20in-browser%20tool%20for%20writing%2C%20validating%2C%20and%0A%23%20testing%20GraphQL%20queries.%0A%23%0A%23%20Type%20queries%20into%20this%20side%20of%20the%20screen%2C%20and%20you%20will%20see%20intelligent%0A%23%20typeaheads%20aware%20of%20the%20current%20GraphQL%20type%20schema%20and%20live%20syntax%20and%0A%23%20validation%20errors%20highlighted%20within%20the%20text.%0A%23%0A%23%20GraphQL%20queries%20typically%20start%20with%20a%20%22%7B%22%20character.%20Lines%20that%20starts%0A%23%20with%20a%20%23%20are%20ignored.%0A%23%0A%23%20An%20example%20GraphQL%20query%20might%20look%20like%3A%0A%23%0A%23%20%20%20%20%20%7B%0A%23%20%20%20%20%20%20%20field(arg%3A%20%22value%22)%20%7B%0A%23%20%20%20%20%20%20%20%20%20subField%0A%23%20%20%20%20%20%20%20%7D%0A%23%20%20%20%20%20%7D%0A%23%0A%23%20Keyboard%20shortcuts%3A%0A%23%0A%23%20%20Prettify%20Query%3A%20%20Shift-Ctrl-P%20(or%20press%20the%20prettify%20button%20above)%0A%23%0A%23%20%20%20%20%20%20%20Run%20Query%3A%20%20Ctrl-Enter%20(or%20press%20the%20play%20button%20above)%0A%23%0A%23%20%20%20Auto%20Complete%3A%20%20Ctrl-Space%20(or%20just%20start%20typing)%0A%23%0A%0Aquery%20Scene%20(%24application%3AString%20%3D%20%22fiercesprout%22%2C%20%24scene%3AString%3D%22scene1%22)%7B%0A%20%20scene%20(application%3A%24application%2C%20scene%3A%24scene)%7B%0A%20%20%20%20title%0A%20%20%20%20world%20%7B%0A%20%20%20%20%20%20width%0A%20%20%20%20%20%20height%0A%20%20%20%20%20%20unit%0A%20%20%20%20%20%20minVertexX%0A%20%20%20%20%20%20minVertexY%0A%20%20%20%20%20%20maxVertexX%0A%20%20%20%20%20%20maxVertexY%0A%20%20%20%20%7D%0A%20%20%20%20layerDef%7B%0A%20%20%20%20%20%20target%0A%20%20%20%20%20%20worldObject%7B%0A%20%20%20%20%20%20%20%20name%0A%20%20%20%20%20%20%20%20component%0A%20%20%20%20%20%20%7D%0A%20%20%20%20%7D%0A%20%20%7D%0A%7D&operationName=Scene
      const request : XMLHttpRequest = new XMLHttpRequest()

      request.open('GET', './arc')
      request.setRequestHeader('X-Query', btoa(encodeURIComponent(result.config.query)))
      request.setRequestHeader('X-Params', btoa(encodeURIComponent('{}')))

      request.onload = () => {
        const payload : Object = JSON.parse(request.response)

        if (payload.error) {
          console.log('there was an error associated with this request')
        }

        OnApply({...action.payload, ...payload.data})
      }

      request.send()
    })
  }

  /**
   * #TODO: For each path on the subscription list, we need to update with the data from the change.
   * with ambiguous paths.
   * @param {*} steps 
   * @param {*} action 
   */
  function Update (steps: Array, action: Action) {
    const t: Hermes = this

    // we need to update the branch for the store where the path is concerned
    // no payload as this is just a path update
    const store: Object = Branch(Store, steps, (node : Object, step : string, i : number) : Object => {
      const path : Array = steps.slice(0, i + 1)

      const {result} = Trace.call(t, path, reducerEnds, true) // look for an exact path match in the reducers
      const payload: Object = i === steps.length - 1 ? action.payload : undefined

      Events.SetContext(path.join('/'))

      if (!result || !result.reducer) {
        return reducer.Reduce(action, node, payload)
      }

      return result.reducer.Reduce(action, node, payload)
    })

    // then the returned heap needs to be updated (tree structure, no longer branch path)
    // payloads exist because we are now in the returned object heap. 
    Tree(store, action.payload, (node : Object, payload : Object, keys : Array) : Object => {
      const path : Array = [...steps, ...keys]

      const {result} = Trace.call(t, path, reducerEnds, true) // look for an exact path match in the reducers

      Events.SetContext(path.join('/'))

      if (!result || !result.reducer) {
        return reducer.Reduce(action, node, payload)
      }

      return result.reducer.Reduce(action, node, payload)
    }, reducers)
  }

  function Tree (target: Object, heap: Object | Array, onNode?: callback, keys: Array = []) : Object {
    if (toString.call(heap) === '[object Array]') {
      let i : number = -1 
      let member : any

      while ((member = heap[++i])) {
        if (typeof member !== 'object') {
          continue
        }

        const childKeys : Array = [...keys, i]
        const typeString : string = toString.call(member)

        target[i] = Tree(target[i] || (typeString === '[object Array]' ? new Array(member.length) : Object.create(null)), member, onNode, childKeys)
        target[i] = onNode(target[i], member, childKeys)
      }

      return target
    }

    for (let key in heap) {
      let node: any = heap[key]
      const typeString : string = toString.call(node)

      if (typeString === '[object Object]' || typeString === '[object Array]') {
        const childKeys: Array = [...keys, key]

        target[key] = Tree(target[key] || (typeString === '[object Array]' ? new Array(node.length) : Object.create(null)), node, onNode, childKeys)
        target[key] = onNode(target[key], node, childKeys)
      }
    }

    return target
  }

  function Branch (target: Object, steps: Array, onNode?: callback, parenting: boolean = false): Object {
    // our store needs to be updated with the values
    let i: number = -1
    const l: number = steps.length

    onNode = onNode || ((node: Object) => {
      return node
    })

    while (++i < l) {
      const step: string = steps[i]

      if (!step) {
        continue
      }

      target[step] = onNode(target[step] || Object.create(null), step, i)

      if (parenting) {
        target[step].parent = target
      }

      target = target[step]
    }

    return target
  }

  return instances[props.name] || (instances[props.name] = new Hermes(props))
}

/**
 * We map strings longest first so that we can ensure that the closest matches for paths is always found
 * @param {*} object 
 */
function OrderByLongest (object : Object) {
  let keys : Array = Object.keys(object)
  const orderedObject : Object = Object.create(null)

  keys.sort((a : string, b : string) : number => {
    if (a.length > b.length) {
      return -1
    }

    if (b.length > a.length) {
      return 1
    }

    return 0
  })

  let i : number = -1
  const l : number = keys.length

  while (++i < l) {
    const key : string = keys[i]

    orderedObject[key] = object[key]
  }

  return orderedObject 
}

Hermes.Instance = function (name: string, props: Object) {
  if (instances[name]) {
    return instances[name]
  }

  if (!props) {
    throw new Error('no instance exists under this name, you can create a new instance here but must provide properties as a second parameter')
  }

  props.name = name

  return new Hermes(props)
}

export {
  Reducer
}

export default Hermes