import Emitter from './Emitter'

import { gsap } from 'gsap/gsap-core'

class Ticker {
  /**
   * Constructor
   */
  constructor () {
    this.callbacks = []

    this.delta = 0
  }

  /**
   * Init
   */
  init () {
    gsap.ticker.add(this.tick.bind(this))
  }

  /**
   * Tick
   */
  tick(time, delta) {
    this.delta = delta

    const queue = this.callbacks
    this.callbacks = []

    queue.forEach((object) => {
      object.callback.apply(object.context)
    })

    Emitter.emit('tick', time * 1000)
  }

  /**
   * Next tick
   */
  nextTick (callback, context) {
    this.callbacks.push({
      callback,
      context
    })
  }
}

export default new Ticker()
