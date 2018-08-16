const {toString} = Object.prototype

export default class Action {
  static DEFAULT : string = 'action.default'

  constructor (name : string, payload : Object = Object.create(null), context : Object = Object.create(null)) {
    const t : Action = this

    if (!name || typeof name !== 'string') {
      throw new Error('the first parameter must be a string identifier')
    }

    t.name = name 
    t.payload = payload
    t.context = context
  }
}