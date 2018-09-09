import Action from './Action'

const {toString} = Object.prototype
const ARRAY : string = '[object Array]' 
const OBJECT : string = '[object Object]'

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

    const stateType = toString.call(state)
    const payloadType = toString.call(payload)

    // Because children can update, you must update only your layer of influence.
    // In lamence terms, only update the state with the root layer of values... I think... this I guess depends on whether a custom child mutation has happened?
    // The default reducer will apply to children... so I guess there will be updates there too...

    if (stateType !== payloadType) {
      return payloadType === ARRAY ? [...payload] : {...payload}
    }

    if (stateType === ARRAY) {
      const newState : Array = new Array(payload.length)
      let i : number = payload.length
      
      while (i--) {
        const item : any = state[i]

        if (typeof item === 'object') {
          newState[i] = item || payload[i]
        } else {
          newState[i] = payload[i]
        }
      }

      return newState
    }

    const newState : Object = {...state, ...payload}
    const keys : Array = Object.keys(state)

    let i : number = -1
    const l : number = keys.length

    while (++i < l) {
      const item : any = state[key]

      if (typeof item === 'object') {
        newState[key] = item
      }
    }

    return newState
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