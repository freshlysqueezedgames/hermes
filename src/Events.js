
  let events : Array = []
  const callbacks : Object = Object.create(null)

  let context : string = ""

  export default class Events {
    static AddEvent (name : string, payload : Object) {
      console.log('adding event!', name)
      events.push({name, payload, context})
    }

    /**
     * Set Context In Hermes is a means of determining the path that may have lead to the change. Reducers
     * are re-usable, and we need to be able to trigger events in a certain context.
     * @param {*} name 
     */
    static SetContext (name : string) {
      context = name
    }
    
    /**
     * @name Subscribe
     * @description This is used to set the callbacks on what is available.
     * @param {*} name 
     * @param {*} callback
     */
    static Subscribe (name : string, callback : Function, context : string, projection: Object) {
      const list : Array = callbacks[name] = callbacks[name] || [] // create a new array if there isn't one

      callback.context = context
      callback.projection = projection

      list.push(callback)
    }
    
    static Dispatch () {
      let i : number = -1
      let event : Object
      
      while ((event = events[++i])) {
        if (!callbacks[event.name]) {
          continue
        }

        const list : Array = callbacks[event.name]

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

      events = []
    }
  }