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

  /**
   * @constructor
   * @description Takes the property configuration and build the store, path and reducer heaps. Keeping appropriate linear leaf references for fast lookup times
   * @param {Object} props 
   */
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
        if (hasOwnProperty.call(props.reducers, key)) {
          const targetReducer: Reducer = props.reducers[key]

          if (!(targetReducer instanceof Reducer)) {
            throw new Error('Property at path: ', key, ' is not a Reducer instance!')
          }

          if (targetReducer.path !== '') {
            throw new Error(`Reducer instances must be unique to each path for Hermes to efficiently find the correct location to allocate actions: ${key} & ${targetReducer.path} share the same instance`)
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
      }
    } else if (props.verbose) {
      console.warn('No reducers have been defined for the instance, this means all data will be copied as submitted in action payloads: ', props.name)
    }

    t.reducer = new Reducer()
    t.reducer.hermes = t
  }  

  /**
   * @name AddEvent
   * @description The number 
   * @param {*} name 
   * @param {*} payload 
   * @param {*} context 
   */
  AddEvent (name : string, payload : Object) {
    this.events.push({name, payload, path : this.currentPath, context : this.context})
  }

  /**
   * @name SetContext
   * @description This marks the current path when a reducer event is fired, along with path params if the path is ambiguous
   * @param {string} name L 
   */
  SetContext (path : string, context : Object) {
    this.currentPath = path
    this.context = context
  }

  Dispatch () {
    const t : Hermes = this
    let i : number = -1
    let event : Object

    while ((event = t.events[++i])) {
      if (!t.callbacks[event.name]) {
        continue
      }

      const list : Array = t.callbacks[event.name]

      let j : number = -1
      let callback

      while ((callback = list[++j])) {
        if (callback.path && callback.path !== event.path) {
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
  
  /**
   * @name Subscribe
   * @description Applies a listener to 
   * @param {*} name 
   * @param {*} callback 
   * @param {*} context 
   * @param {*} projection 
   */
  Subscribe (name: string, callback: Function, path : string, projection: Object): Hermes {
    const t: Hermes = this

    if (!name || typeof name !== 'string' || toString.call(callback) !== FUNCTION) {
      throw new Error('you must always call Subscribe with a string path and a callback function')
    }

    for (let key in projection) {
      projection[key] = projection[key].split('/')
    }

    const list : Array = t.callbacks[name] = t.callbacks[name] || [] // create a new array if there isn't one

    callback.path = path
    callback.projection = projection

    list.push(callback)

    return t
  }

  /**
   * @name Do
   * @description Performs an action and applies it to the heap
   * @param {Action} action : The action to take 
   * @param {string[Optional]} path : optionally, you can set the path to avoid the lookup cycle, this will avoid a linear lookup through the reducer list
   * @return {Promise} A promise that resolves when the action has been executed
   * @public
   */
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
   * @name Trace
   * @description Using a list of leaves from the heap, this function will find the matching branch to a list of steps
   * #TODO: Should store results so that if invoked multiple times we have a record of the correct path for performance
   * @param {Array} steps : The path represented as an array of keys
   * @param {Array[Optional]} ends : A list of leaves from a Hermes heap.
   * @return {Object} the resultant request path if any, and the leaf
   * @public
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

  /**
   * @name Query
   * @description Takes a path and runs a server request if required. Will then apply resultant data on the Action as it's payload for the reducers
   * @param {string} path: The path that the action will be applied to
   * @param {Action} action: the action invoked
   * @return {Promise}
   * @public
   */
  async Query (path: string, action: Action): Promise {
    const t: Hermes = this

    if (t.verbose) {
      console.log('getting this path!', path)
    }

    const steps: Array = path.split('/')
    const {requestPath, result} = t.Trace(steps)

    const OnApply: Function = (payload: Object = Object.create(null)) => {
      action.payload = payload // Override the payload with the new one given

      // Update the store, and ensure that the new state is in place.
      t.Update(steps, action)

      // This part, working in parent-first left-to-right, we should trigger any subscribers at each path within the CHANGED heap.
      //Publish.call(t, steps, action)
      t.Dispatch()
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

    try {
      OnApply(await Request.call(t))
    } catch (error) {
      console.warn('Request failed in the network')
    }
  }

  /**
   * @name Update
   * @description This follows the designated path along each step in the heap's branch, and then applies the data
   * heap to the store from there 
   * @param {Array} steps: The path represented as an array of keys
   * @param {Action} action: The action to perform on the heap
   * @return {Hermes}
   */
  Update (steps: Array, action: Action) : Hermes {
    const t: Hermes = this

    // we need to update the branch for the store where the path is concerned
    // no payload as this is just a path update
    const store: Object = t.Branch(t.store, steps, (node : Object, step : string, i : number) : Object => {
      const path : Array = steps.slice(0, i + 1)

      const {result} = t.Trace(path, t.reducerEnds, true) // look for an exact path match in the reducers
      const payload: Object = i === steps.length - 1 ? action.payload : undefined

      t.SetContext(path.join('/'), action.context)

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

      t.SetContext(path.join('/'), action.context)

      if (!result || !result.reducer) {
        return t.reducer.Reduce(action, node, payload)
      }

      return result.reducer.Reduce(action, node, payload)
    }, t.reducerHeap)

    return t
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

function Request () : Promise {
  // We need to be able to deviate here based on the type of request. Either it will follow a REST style system or GraphQL style system
  const {protocol, host, port, endPoint} = t

  return new Promise ((resolve : Function, reject : Function) => {
    const request : XMLHttpRequest = new XMLHttpRequest()

    request.open('GET', `${protocol}://${host}:${port}/${endPoint}`)
    request.setRequestHeader('Query', btoa(result.config.query))
    request.setRequestHeader('Params', btoa(JSON.stringify(action.payload)))
  
    request.onload = () => {
      const payload : Object = JSON.parse(request.response)
  
      if (payload.error) {
        console.log('there was an error associated with this request')
      }
  
      resolve && resolve({...action.payload, ...payload.data})
    }

    request.onerror = (error : Object) => reject && reject(error)
  
    request.send()
  })
}