import Action from './Action'

const {toString} = Object.prototype
const ARRAY = '[object Array]' 

export default class Reducer {
  static EVENTS : Object = {
    CHANGE : 'reducer.change'
  }
  
  constructor () {
    const t : Reducer = this

    t.path = ""
    t.hermes = null
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
  Reduce (action : Action, state : Object | Array = Object.create(null), payload? : Array | Object) : Object | Array {
    if (!payload) {
      return state
    }

    return toString.call(state) === ARRAY ? [...payload] : {...state, ...payload}
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
  Dispatch (eventName : string) {
    this.hermes.AddEvent(eventName)
  }
}