const {toString} = Object.prototype

class Action {
  static DEFAULT : string = 'action.default'

  constructor (name : string, payload : Object = Object.create(null), context : Object = Object.create(null), method? : string) {
    const t : Action = this

    if (!name || typeof name !== 'string') {
      throw new Error('the first parameter must be a string identifier')
    }

    t.name = name 

    if (payload) {
      t.payload = payload
    }

    t.context = context
  }

  Is (name : string) : boolean {
    return name === this.name
  }
}

export default Action