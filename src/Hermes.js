import pathToRegexp from 'path-to-regexp'

import Action from './Action'
import Reducer from './Reducer'
import Route from './Route'
import {OrderByLongest} from './Utils'

const {toString, hasOwnProperty} = Object.prototype

const FUNCTION : string = '[object Function]'
const ARRAY : string = '[object Array]'
const OBJECT : string = '[object Object]'

/** 
 * @class Hermes
 * @description This singleton manages stores in the context of a external data source and marries thet.pathHeap not only to the urls for the server,
 * but for the object traversal itself. Making it possible to listen for changes to data at any specific point in a heap. As any flux design, actions
 * trigger changes in the t.store (including from the server) and views can subscribe to object changes in the heap(s)
*/
export default class Hermes {
  static DEFAULTS : Object = {
    protocol : 'http',
    host : '127.0.0.1',
    port : '80',
    endPoint : 'arc'
  }

  constructor (props: Object) {
    props = {...Hermes.DEFAULTS, ...props}

    const t : Hermes = this

    t.events = []
    t.callbacks = Object.create(null)
    t.context = ""

    // Each hermes instance has a private store that is used to manage a state heap.
    t.store = Object.create(null)

    t.pathHeap = Object.create(null) // t.stores path information in a searchable heap
    t.pathEnds = [] // We can more efficiently tracet.pathHeap by working backwards from the leaves to the root

    t.reducerHeap = Object.create(null)
    t.reducerEnds = []

    // Apply props to the instance
    t.verbose = props.verbose || false
    t.paths = props.paths || false

    t.host = props.host
    t.protocol = props.protocol
    t.port = props.port
    t.endPoint = props.endPoint
    
    // Now we need to apply our paths to create our initial heap
    if (props.paths) {
      props.paths = OrderByLongest(props.paths)

      for (let key in props.paths) {
        let config: any = new Route(key, props.paths[key])

        const current: Object = t.Branch(t.pathHeap, key.split('/'), (node : Object, step : string, i : number) : Object => {
          node.step = step
          node.position = i + 1

          return node
        }, true)

        t.pathEnds.push(current)
        current.config = config
      }
    }

    if (props.reducers) {
      props.reducers = OrderByLongest(props.reducers)

      for (let key in props.reducers) {
        const targetReducer: Reducer = props.reducers[key]

        if (!(targetReducer instanceof Reducer)) {
          throw new Error('Property at path: ', key, ' is not a Reducer instance!')
        }

        // Bind a function for accessing the events list. There is one list per Hermes.
        targetReducer.hermes = t

        const current: Object = t.Branch(t.reducerHeap, key.split('/'), (node : Object, step : string, i : number) => {
          node.step = step
          node.position = i + 1

          return node
        }, true)

        t.reducerEnds.push(current)

        current.reducer = targetReducer
        targetReducer.path = key
      }
    } else if (props.verbose) {
      console.warn('No reducers have been defined for the instance, this means all data will be copied as submitted in action payloads: ', props.name)
    }

    t.reducer = new Reducer()
    t.reducer.hermes = t
  }  

  AddEvent (name : string, payload : Object, context : Object) {
    this.events.push({name, payload, context : this.context})
  }

  /**
   * Set Context In Hermes is a means of determining the path that may have lead to the change. Reducers
   * are re-usable, and we need to be able to trigger events in a certain context.
   * @param {*} name 
   */
  SetContext (name : string, params : Object) {
    this.context = name
    this.params = params
  }
  
  Dispatch () {
    const t : Hermes = this
    let i : number = -1
    let event : Object

    console.log('dispatching for!', t.events)

    while ((event = t.events[++i])) {
      if (!t.callbacks[event.name]) {
        continue
      }

      const list : Array = t.callbacks[event.name]

      let j : number = -1
      let callback

      while ((callback = list[++j])) {
        if (callback.context && callback.context !== event.context) {
          continue
        }

        let content : Object = {...event}

        if (callback.projection) {
          const payload : Object = Object.create(null)

          for (let key in callback.projection) {
            const item : Array = callback.projection[key]
            let target : any = event.payload
            let i : number = 0
            const l : number = item.length

            while((target = target[item[i++]]) && i < l);

            payload[key] = target
          }

          content.payload = payload
        }

        if (callback(content, event.context)) {
          list.splice(j--, 1)
        }
      }
    }

    t.events = []
  }
  
  Subscribe (name: string, callback: Function, context : string, projection: Object): Hermes {
    const t: Hermes = this

    if (!name || typeof name !== 'string' || toString.call(callback) !== FUNCTION) {
      throw new Error('you must always call Subscribe with a string path and a callback function')
    }

    for (let key in projection) {
      projection[key] = projection[key].split('/')
    }

    const list : Array = t.callbacks[name] = t.callbacks[name] || [] // create a new array if there isn't one

    callback.context = context
    callback.projection = projection

    list.push(callback)

    return t
  }

  Do (action: Action, path? : string): Promise {
    const t: Hermes = this

    if (!(action instanceof Action)) {
      throw new Error('Parameter 1 must be an Action instance', action)
    }

    if (typeof path !== 'string') {
      // We look at the instance, and determine our path based on the reducer instance associated with the action
      let i: number = t.reducerEnds.length
      const targetReducer: Reducer = action.Reducer()

      // Match the reducer
      while (i--) {
        const reducerEnd: Reducer = t.reducerEnds[i].reducer

        if (targetReducer === reducerEnd) {
          path = reducerEnd.path

          // notify reducer of submission
          reducerEnd.Submission(action)
          break
        }
      }
    }

    // one time call for the first request of the data
    return t.Query(pathToRegexp.compile(path)(action.context), action)
  }

  /**
   * This looks at thet.pathHeap and determines which is the closest match, working from 
   * the leaves downwards
   * @param {*} steps 
   */
  Trace (steps: Array, ends?: Array) {
    const t: Hermes = this

    ends = ends || t.pathEnds

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

  Query (path: string, action: Action): Promise {
    const t: Hermes = this

    if (t.verbose) {
      console.log('getting this path!', path)
    }

    return new Promise((resolve: Function, reject: Function) => {
      const steps: Array = path.split('/')
      const {requestPath, result} = t.Trace(steps)

      const OnApply: Function = (payload: Object = Object.create(null)) => {
        action.payload = payload // Override the payload with the new one given

        // Update the store, and ensure that the new state is in place.
        t.Update(steps, action)

        // This part, working in parent-first left-to-right, we should trigger any subscribers at each path within the CHANGED heap.
        //Publish.call(t, steps, action)
        t.Dispatch()

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
      const {protocol, host, port, endPoint} = t

      request.open('GET', `${protocol}://${host}:${port}/${endPoint}`)
      request.setRequestHeader('Query', btoa(result.config.query))
      request.setRequestHeader('Params', btoa(JSON.stringify(action.payload)))

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
   * with ambiguoust.pathHeap.
   * @param {*} steps 
   * @param {*} action 
   */
  Update (steps: Array, action: Action) {
    const t: Hermes = this

    // we need to update the branch for the store where the path is concerned
    // no payload as this is just a path update
    const store: Object = t.Branch(t.store, steps, (node : Object, step : string, i : number) : Object => {
      const path : Array = steps.slice(0, i + 1)

      const {result} = t.Trace(path, t.reducerEnds, true) // look for an exact path match in the reducers
      const payload: Object = i === steps.length - 1 ? action.payload : undefined

      t.SetContext(path.join('/'))

      if (!result || !result.reducer) {
        return t.reducer.Reduce(action, node, payload)
      }

      return result.reducer.Reduce(action, node, payload)
    })

    // then the returned heap needs to be updated (tree structure, no longer branch path)
    // payloads exist because we are now in the returned object heap. 
    t.Tree(store, action.payload, (node : Object, payload : Object, keys : Array) : Object => {
      const path : Array = [...steps, ...keys]
      const {result} = t.Trace(path, t.reducerEnds, true) // look for an exact path match in the reducers

      t.SetContext(path.join('/'))

      if (!result || !result.reducer) {
        return t.reducer.Reduce(action, node, payload)
      }

      return result.reducer.Reduce(action, node, payload)
    }, t.reducerHeap)
  }

  Tree (target: Object, heap: Object | Array, onNode?: callback, keys: Array = []) : Object {
    const t : Hermes = this

    if (toString.call(heap) === ARRAY) {
      let i : number = -1
      let member : any

      while ((member = heap[++i])) {
        if (typeof member !== 'object') {
          continue
        }

        const childKeys : Array = [...keys, i]
        const typeString : string = toString.call(member)

        target[i] = onNode(target[i], member, childKeys)
        target[i] = t.Tree(target[i] || (typeString === ARRAY ? new Array(member.length) : Object.create(null)), member, onNode, childKeys)
      }

      return target
    }

    for (let key in heap) {
      let node: any = heap[key]
      const typeString : string = toString.call(node)

      if (typeString === OBJECT || typeString === ARRAY) {
        const childKeys: Array = [...keys, key]

        target[key] = onNode(target[key], node, childKeys)
        target[key] = t.Tree(target[key] || (typeString === ARRAY ? new Array(node.length) : Object.create(null)), node, onNode, childKeys)
      }
    }

    return target
  }

  Branch (target: Object, steps: Array, onNode?: callback, parenting: boolean = false): Object {
    const t : Hermes = this

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

  Print () {
    console.log('this is the store', t.store)
  }
}
