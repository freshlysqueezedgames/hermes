import Action from './Action'

const {toString} = Object.prototype

let id : number = 0

export default class Reducer {
  static EVENTS : Object = {
    CHANGE : 'reducer.change'
  }
  
  constructor () {
    const t : Reducer = this

    t.path = ""
    t.hermes = null

    t.id = id++
  }

  /**
   * @name Submission
   * @description Callback for when an Action is submitted that affects the reducer. This can be used to dispatch events
   * triggering state updates within the UI (say you wish to notify the user of an impending update to information and want to display something to indicate such)
   * @param {Action} action The action submitted into the system. 
   */
  Submission (action : Action) : Reducer {
    return this
  }

  /**
   * @name Reduce
   * @description This is called when a payload is ready to be incorporated in the store heap. Before this happens, the Reducer can be overridden
   * so that the payload object is handled in the proper manner.
   * 
   * NOTE: If you have child reducers (reducers assigned to child addresses) of the store heap, there is no need to modify these at they are handled first and
   * will already have been affected.
   * @param {*} action 
   * @param {*} state 
   * @param {*} payload 
   */
  Reduce (action : Action, state : Object | Array = Object.create(null), payload : Array | Object = Object.create(null)) : Object | Array {
    const t : Reducer = this

    console.log('hello!');
    
    if (toString.call(state) === '[object Array]') {
      if (state.length === payload.length) {
        [...state]
      }

      return [...payload]
    }

    return {...state, ...payload}
  }

  /**
   * @name Action
   * @description This is the way the system creates Actions. 
   * @param {*} name 
   * @param {*} payload 
   * @param {*} context 
   */
  Action (name : string, payload? : Object, context? : Object) : Action {
    const action = new Action(name, payload, context)

    action.Reducer = () => {
      return this 
    }

    return action
  }

  /**
   * @name Dispatch
   * @description Adds events to a list of events that gets triggered once the store has fully updated.
   * @param {String} eventName 
   * @param {Object} data 
   */
  Dispatch (eventName : string, data : Object) {
    this.hermes.AddEvent(eventName, data)
  }
}