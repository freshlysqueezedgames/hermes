import pathToRegexp from 'path-to-regexp'

import Action from './Action'
import Reducer from './Reducer'
import Route from './Route'

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
  /**
   * @constructor
   * @description Takes the property configuration and build the store, path and reducer heaps. Keeping appropriate linear leaf references for fast lookup times
   * @param {Object} props 
   */
  constructor (props: Object) {
    const t : Hermes = this

    t.events = []
    t.callbacks = Object.create(null)
    t.context = ""

    // Each hermes instance has a private store that is used to manage a state heap.
    t.store = Object.create(null)

    t.reducerHeap = Object.create(null)
    t.reducerEnds = []

    // Apply props to the instance
    t.verbose = props.verbose || false
    t.dispatchActions = props.dispatchActions === false ? false : true

    t.ignoreEvents = false

    if (props.remote) {
      let {paths, request} = props.remote

      if (!paths) {
        throw new Error('Paths must be specified on the remote where you expect a server connection to occur')
      }

      if (!request) {
        throw new Error('A request function must be defined so that hermes can give appropriate data back to you')
      }

      paths = [...paths]
      
      paths.sort((a : string, b : string) : number => {
        if (a.length > b.length) {
          return -1
        }
    
        if (b.length > a.length) {
          return 1
        }
    
        return 0
      })

      let i : number = -1
      const l : number = paths.length

      while (++i < l) {
        paths[i] = new Route(paths[i])
      }

      t.remote = {request, paths}
    }

    const {reducers} = props

    if (reducers) {
      for (let key in reducers) {
        if (hasOwnProperty.call(reducers, key)) {
          const targetReducer: Reducer = reducers[key]

          if (!(targetReducer instanceof Reducer)) {
            throw new Error('Property at path: ', key, ' is not a Reducer instance!')
          }

          if (targetReducer.path !== '') {
            throw new Error(`Reducer instances must be unique to each path for Hermes to efficiently find the correct location to allocate actions: ${key} & ${targetReducer.path} share the same instance`)
          }

          // Bind a function for accessing the events list. There is one list per Hermes.
          targetReducer.hermes = t

          Branch(t.reducerHeap, key.split('/'), (node : Object = Object.create(null), step : string, i : number) => {
            node.step = step
            node.position = i + 1

            return node
          }, true, (current : Object) => {
            t.reducerEnds.push(current)

            current.reducer = targetReducer

            return current
          })

          targetReducer.path = key
          targetReducer.keys = []
          targetReducer.regex = pathToRegexp(key, targetReducer.keys)

          targetReducer.keys = targetReducer.keys.map((key : Object) => {
            return key.name
          })
        }
      }
    } else if (props.verbose) {
      console.warn('No reducers have been defined for the instance, this means all data will be copied as submitted in action payloads: ', props.name)
    }

    t.reducer = new Reducer()
    t.reducer.hermes = t
  
    t.map = {} // this will be used to index matching reducers based on paths
  }
  
  /**
   * @name Subscribe
   * @description Applies a listener to 
   * @param {*} name 
   * @param {*} callback
   * @param {*} context
   */
  Subscribe (name: string, callback: Function, path? : string): Hermes {
    const t: Hermes = this

    if (!name || typeof name !== 'string' || toString.call(callback) !== FUNCTION) {
      throw new Error('you must always call Subscribe with a string path and a callback function')
    }

    const list : Array = t.callbacks[name] = t.callbacks[name] || [] // create a new array if there isn't one

    if (path) {
      callback.keys = []
      callback.regex = pathToRegexp(path, callback.keys)
    }

    list.push(callback)

    return t
  }

  Unsubscribe (name : string, callback? : Function) : Hermes {
    const t : Hermes = this
    const list : Array = t.callbacks[name]

    if (!list) {
      return t
    }

    if (typeof callback === 'undefined') {
      delete t.callbacks[name]
      return t
    }

    let i : number = list.length

    while (i--) {
      const item : Object = list[i]

      item === callback && list.splice(i, 1) // could be more than one subscription of this I suppose...
    }

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

    if (t.current) {
      return (t.current = t.current.then(() : Promise => t.Do(action, path)))
    }

    // one time call for the first request of the data
    return (t.current = Query.call(t, pathToRegexp.compile(path || action.Reducer().path)(action.context), action).then(() => {
      t.current = null
    }))
  }

  /**
   * @name AddEvent
   * @description The number 
   * @param {*} name 
   * @param {*} payload
   * @param {*} context
   * @return {Hermes}
   * @public
   */
  AddEvent (name : string) : Hermes {
    const t : Hermes = this

    if (t.ignoreEvents) {
      return t
    }

    t.events.push({name, payload : t.payload, path : t.currentPath, context : t.context})

    return t
  }

  GetState () : Object {
    return this.store
  }

  Print () : Hermes {
    console.log(this.store)
    return this
  }
}

function Dispatch () {
  const t : Hermes = this

  let i : number = -1
  const l : number = t.events.length

  while (++i < l) {
    const event : Object = t.events[i]

    if (!t.callbacks[event.name]) {
      continue
    }

    const list : Array = t.callbacks[event.name]

    let j : number = -1
    let l2 : number = list.length

    while (++j < l2) {
      const callback : Function = list[j]
      let result : Array

      if (callback.regex && !(result = callback.regex.exec(event.path))) {
        continue
      }

      let content : Object = {...event}

      content.payload = content.payload() // invoke this to collect the resultant state, and remove the reference for GC

      const keys : Array = callback.keys

      if (keys && keys.length) { // if the urls have keys, we need to gather the values so we can show the context
        const context : Object = Object.create(null)

        result.shift()

        let i : number = keys.length

        while (i--) {
          context[keys[i].name] = result[i]
        }

        content.context = context
      }

      if (callback(content)) {
        list.splice(j--, 1)
        l2--
      }
    }
  }

  t.events = []
  t.currentPath = ''
  
  t.payload = null
  t.context = null
}

/**
 * @name SetContext
 * @description This marks the current path when a reducer event is fired, along with path params if the path is ambiguous
 * @param {string} name L 
 */
function SetContext (path : string, context : Object, payload : Function) {
  const t : Hermes = this
  
  t.currentPath = path
  t.context = context
  t.payload = payload
}

function MatchingReducers (path : string) : Array {
  const t : Hermes = this
  const {reducerEnds} = t
  let reducers : Array
  
  if (t.map[path]) { // cuts out having to do regex's more than once on a path.
    return t.map[path]
  }

  let i : number = -1
  const l : number = reducerEnds.length

  while (++i < l) {
    const reducer : Reducer = reducerEnds[i].reducer

    if (reducer.regex.exec(path) !== null) {
      (reducers = reducers || []).push(reducer)
    }
  }

  return (t.map[path] = reducers)
}

/**
 * @name Query
 * @description Takes a path and runs a server request if required. Will then apply resultant data on the Action as it's payload for the reducers
 * @param {string} path: The path that the action will be applied to
 * @param {Action} action: the action invoked
 * @return {Promise}
 * @public
 */
async function Query (path: string, action: Action): Promise {
  const t: Hermes = this

  if (t.verbose) {
    console.log('getting this path!', path)
  }

  const steps : Array = path.split('/')
  const OnApply: Function = (payload: Object = Object.create(null)) => {
    action.payload = payload // Override the payload with the new one given

    if (t.verbose) {
      console.log('Updating with this action payload', action, t.store)
    }

    // Update the store, and ensure that the new state is in place.
    Update.call(t, steps, action, path)

    // This part, working in parent-first left-to-right, we should trigger any subscribers at each path within the CHANGED heap.
    //Publish.call(t, steps, action)
    Dispatch.call(t)
  }

  if (!t.remote || !t.remote.paths || !t.remote.paths.length) {
    OnApply(action.payload)
    return
  }
  
  const {paths} : Array = t.remote

  let i : number = -1
  const l : number = paths.length

  let requestPath : string

  while (++i < l) {
    const item : string = paths[i]

    if (item.re.test(path)) {
      if (action.context && Object.keys(action.context).length) {
        requestPath = item.ToPath(action.context)
      } else {
        requestPath = item.originalPath
      }
      break
    }
  }

  if (!requestPath) {
    // this is not a requestable piece of data!
    OnApply(action.payload)
    return
  }

  let state : Object

  Branch(t.store, steps, undefined, false, (node : Object) => {
    return (state = node || Object.create())
  })

  try {
    const result : Object = await new Promise ((resolve : Function, reject : Function) => {
      if(t.remote.request(requestPath, action, state, (payload : Object) => resolve && resolve({...action.payload, ...payload})) === false) {
        resolve(action.payload)
      }
    })
  
    if (t.verbose) {
      console.log('Request result!', result)
    }

    OnApply(result)
  } catch (error) {
    console.log('what the hell just happened?', error)
    throw new Error(error)
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
function Update (steps: Array, action: Action, originalPath : string) : Hermes {
  const t: Hermes = this
  let actionDispatched : boolean

  function OnStep (node : Object, path : Array, payload : Object, test : boolean = false) {
    const strPath : string = path.join('/')
    const result = MatchingReducers.call(t, strPath) || [t.reducer] // look for an exact path match in the reducers

    let state : Object | Array = node 
    
    if (!state) {
      t.ignoreEvents = true
      state = result[0].Reduce(new Action('__init__'))
      // remove events created as a result.
      t.ignoreEvents = false

      return state
    }

    if (t.verbose) {
      console.log('the reducers to be called are', result)
    }

    let i : number = -1
    const l : number = result.length
    const context : Object = action.context

    while (++i < l) {
      if (result[i].regex) {
        const item : Object = result[i]
        const matches : Array = strPath.match(item.regex)

        matches.shift()

        let j : number = -1
        const keys : Array = item.keys
        const l2 : number = keys.length

        while (++j < l2) {
          context[keys[j]] = matches.shift()
        }
      }
    }

    context.$$path = originalPath

    SetContext.call(t, strPath, action.context, function () {
      return state
    })

    i = -1

    while (++i < l) {
      if (t.dispatchActions && !actionDispatched && path.join('/') === originalPath) { // we should only trigger once, on the Reducer level that created the action.
        t.AddEvent(action.name)
        actionDispatched = true
      }

      state = result[i].Reduce(action, state, payload)
    }

    return state
  }

  function OnAppend (store : Object | Array) {
    // then the returned heap needs to be updated (tree structure, no longer branch path)
    // payloads exist because we are now in the returned object heap.
    if (!action.apply) {
      return store
    }

    return Tree(store, action.payload, (node : Object, payload : Object, keys : Array) : Object => {
      return OnStep(node, [...steps, ...keys], payload)
    }, t.reducerHeap)
  }

  // we need to update the branch for the store where the path is concerned
  // no payload as this is just a path update
  Branch(t.store, steps, (node : Object, step : string, i : number) : Object => {
    return OnStep(node, steps.slice(0, i + 1), i === steps.length - 1 ? action.payload : undefined)
  }, false, OnAppend)

  return t
}

function Tree (target: Object, heap: Object | Array, onNode?: callback, keys: Array = []) : Object {
  if (toString.call(heap) === ARRAY) {
    let i : number = -1
    let member : any

    while ((member = heap[++i])) {
      if (typeof member !== 'object') {
        continue
      }

      const childKeys : Array = [...keys, i]

      target[i] = Tree(target[i] || (toString.call(member) === ARRAY ? new Array(member.length) : Object.create(null)), member, onNode, childKeys)
      target[i] = onNode(target[i], member, childKeys)
    }

    return target
  }

  for (let key in heap) {
    let node: any = heap[key]
    const typeString : string = toString.call(node)

    if (typeString === OBJECT || typeString === ARRAY) {
      const childKeys: Array = [...keys, key]

      target[key] = Tree(target[key] || (typeString === ARRAY ? new Array(node.length) : Object.create(null)), node, onNode, childKeys)
      target[key] = onNode(target[key], node, childKeys)
    }
  }

  return target
}

function Branch (target: Object, steps: Array, onNode?: callback = OnNode, parenting: boolean = false, onAppend? : Function, i : number = 0): Object {
  const step: string = steps[i]

  if (!step) {
    return Branch(target, steps, onNode, parenting, onAppend, i + 1)
  }

  target[step] = target[step] || (toString.call(onNode(target[step], step, i, true)) === ARRAY ? [] : Object.create(null))

  if (i + 1 < steps.length) {
    target[step] = Branch(target[step], steps, onNode, parenting, onAppend, i + 1)
  } else if (onAppend) {
    target[step] = onAppend(target[step])
  }

  target[step] = onNode(target[step], step, i)

  if (parenting) {
    target[step].parent = target
  }

  return target
}

function OnNode (node: Object) { // stops inline creation of objects in branch
  return node
}