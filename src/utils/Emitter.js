class Emitter {
  /**
   * Constructor
   */
  constructor () {
    this.events = []
  }

  /**
   * Attach handler to event
   * @param {String} name Event name
   * @param {Function} callback Handler function
   * @param {Object} context Context
   * @param {Boolean} once Call handler only once
   */
  on(name, callback, context, once = false) {
    if (!this.events[name]) {
      this.events[name] = []
    }

    let exists = false
    this.events[name].forEach((object) => {
      if (object.cb === callback && object.context === context) {
        exists = true
        return
      }
    })
    if (exists) {
      return
    }

    this.events[name].push({
      cb: callback,
      context: context,
      once: once
    })
  }

  /**
   * Single event handler
   * @param {String} name Event name
   * @param {Function} callback Handler function
   * @param {Object} context Context
   */
  once (name, callback, context) {
    this.on(name, callback, context, true)
  }

  /**
   * Emit event
   * @param {String} name Event Name
   */
  emit (name) {
    const data = [].slice.call(arguments, 1)

    if (this.events[name]) {
      const listeners = this.events[name].slice()

      listeners.forEach((object) => {
        object.cb.apply(object.context, data)

        if (object.once) {
          this.off(name, object.cb, object.context)
        }
      })
    }
  }

  /**
   * Detact handler from event
   * @param {String} name Event name
   * @param {Function} callback Handler function
   */
  off (name, callback, context) {
    if (this.events[name]) {
      this.events[name] = this.events[name].filter((object) => {
        return !(object.cb === callback && object.context === context)
      })
    }
  }
}

export default new Emitter()
