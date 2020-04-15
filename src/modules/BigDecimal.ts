import { BigNumber } from 'bignumber.js';
import util from 'util';
export namespace BD {
  export type NumberLike<U extends number = number> = Value<U> | FixedNumberString<U> | number | BigNumber | string;
  export class BigDecimal<U extends number> extends BigNumber {
    static satoshi(n: NumberLike<-8>, unit?: -8): Satoshi {
      return new this(n, -8);
    }

    [util.inspect.custom](): string {
      return `BigDecimal(${this.toNumber()}, ${this._unit})`;
    }

    static wei(n: NumberLike<-18>): Wei {
      return new this(n, -18);
    }

    static xrpDrop(n: NumberLike<-6>): XRPDrop {
      return new this(n, -6);
    }

    static normalized(n: NumberLike<0>): Normalized {
      return new this(n, 0);
    }

    private _unit: U;
    constructor(value: NumberLike, unit: U) {
      super(value as number);
      this._unit = unit;
    }

    static zero(): BigDecimal<0> {
      return new BigDecimal(0, 0);
    }

    eq!: (other: BigDecimal<U>) => boolean;
    gt!: (other: BigDecimal<U>) => boolean;
    gte!: (other: BigDecimal<U>) => boolean;

    lt!: (other: BigDecimal<U>) => boolean;
    lte!: (other: BigDecimal<U>) => boolean;

    normalized(): BigDecimal<0> {
      const multiplier = new BigNumber(10).pow(this._unit);
      return new BigDecimal(super.multipliedBy(multiplier), 0);
    }

    integerValue(rm?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): BigDecimal<U> {
      return new BigDecimal(super.integerValue(rm), this._unit);
    }

    plus(other: BigDecimal<U>): BigDecimal<U> {
      return new BigDecimal(super.plus(other), this._unit);
    }

    minus(other: BigDecimal<U>): BigDecimal<U> {
      return new BigDecimal(super.minus(other), this._unit);
    }

    value(): Value<U> {
      return this.toNumber();
    }

    toFixed(d: number = 0, roundingMode?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): FixedNumberString<U> {
      return super.toFixed(d, roundingMode);
    }

    toSatoshi(): Satoshi { return this.toUnit(-8); }

    toWei(): Wei { return this.toUnit(-18); }

    toUnit<T extends number>(targetUnit: T): BigDecimal<T> {
      const powerDifference = new BigNumber(this._unit).minus(targetUnit);
      const multiplier = new BigNumber(10).pow(powerDifference);
      const bn = this.multipliedBy(multiplier);
      return new BigDecimal(bn, targetUnit);
    }
  }

  export type Value<U> = number & {
    readonly sym?: unique symbol;
    readonly unit?: U;
  };

  export type FixedNumberString<U> = string & {
    readonly sym?: unique symbol;
    readonly unit?: U;
  };

  export interface Normalized extends BigDecimal<0> {}
  export interface Satoshi extends BigDecimal<-8> {}
  export interface Wei extends BigDecimal<-18> {}
  export interface XRPDrop extends BigDecimal<-6> {}

}
