export default class Events {
  constructor () {
    const t : Events = this

    t.events = []
    t.callbacks = Object.create(null)
    t.context = ""
  }


  AddEvent (name : string, payload : Object, context : Object) {
    this.events.push({name, payload, context})
  }

  /**
   * Set Context In Hermes is a means of determining the path that may have lead to the change. Reducers
   * are re-usable, and we need to be able to trigger events in a certain context.
   * @param {*} name 
   */
  SetContext (name : string) {
    this.context = name
  }
  
  /**
   * @name Subscribe
   * @description This is used to set the callbacks on what is available.
   * @param {*} name 
   * @param {*} callback
   */
  Subscribe (name : string, callback : Function, context : string, projection: Object) {
    const t : Events = this
    const list : Array = t.callbacks[name] = t.callbacks[name] || [] // create a new array if there isn't one

    callback.context = context
    callback.projection = projection

    list.push(callback)
  }
  
  Dispatch () {
    const t : Events = this
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
}