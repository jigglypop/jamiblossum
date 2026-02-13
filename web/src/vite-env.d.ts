/// <reference types="vite/client" />

declare module 'lunar-javascript' {
  export class Solar {
    static fromYmdHms(y: number, m: number, d: number, h: number, min: number, s: number): Solar
    getYear(): number
    getMonth(): number
    getDay(): number
    getLunar(): Lunar
  }
  export class Lunar {
    static fromYmd(y: number, m: number, d: number): Lunar
    getSolar(): Solar
    getEightChar(): EightChar
  }
  export class EightChar {
    getYear(): string
    getMonth(): string
    getDay(): string
    getTime(): string
  }
}
