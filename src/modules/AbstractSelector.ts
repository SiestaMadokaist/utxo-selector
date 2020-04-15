import { UTXO, } from '../types';
import { Memoize } from '@cryptoket/ts-memoize';
import { BD } from '../modules/BigDecimal';
import * as bitcoin from 'bitcoinjs-lib';
import BigNumber from 'bignumber.js';
namespace UNIT {
  export const SATOSHI = -8;
}

export interface SelectorConfig {
  inputByteSize: UTXO.ByteSize;
  outputByteSize: UTXO.ByteSize;
  dustThreshold: BD.Value<-8>;
}

export type P<T> = T extends Number ? number :
T extends number ? Number :
T extends String ? string :
T extends string ? String :
T;

export function p<T>(n: T): P<T> {
  return n as unknown as P<T>;
}

const _totalOutputWithoutChange = Symbol('');
const _takeBest = Symbol('');
const _witnessInput = Symbol('');
const _outputs = Symbol('');

interface InputLog extends String {
  readonly sym?: unique symbol;
}

interface OutputLog extends String {
  readonly sym?: unique symbol;
}

export interface SelectorLog {
  fee: BD.FixedNumberString<-8>;
  feeRate: string;
  input: InputLog[];
  output: OutputLog[];
}

export type SelectorConstructor = new (props: UTXO.SelectorProps) => AbstractSelector;

export abstract class AbstractSelector {
  __memo__: {
    [_totalOutputWithoutChange]?: BD.Satoshi;
    changeValue?: BD.Satoshi;
    costPerInput?: BD.Satoshi;
    costPerOutput?: BD.Satoshi;
    inputUtxos?: UTXO.WitnessInput[];
    totalInputs?: BD.Satoshi;
    totalOutputs?: BD.Satoshi;
  } = {};

  constructor(readonly props: UTXO.SelectorProps) {}

  private [_outputs](): UTXO.TxOutput[] {
    return this.props.outputs;
  }

  private [_witnessInput](): UTXO.WitnessInput[] {
    const { inputs } = this.props;
    const accumulator: UTXO.WitnessInput[] = [];
    for (const input of inputs) {
      if (input.nonWitnessUtxo instanceof Buffer) {
        const tx = bitcoin.Transaction.fromBuffer(input.nonWitnessUtxo);
        const output = tx.outs[p(input.index)] as UTXO.WitnessUTXO;
        const witnessUtxo: UTXO.WitnessInput = {
          ...input,
          hash: tx.getHash(),
          witnessUtxo: {
            script: output.script,
            value: output.value
          },
          nonWitnessUtxo: undefined,
        };
        accumulator.push(witnessUtxo);
      } else if (input.witnessUtxo) {
        accumulator.push(input);
      }
    }
    return accumulator;
  }

  private [_takeBest](target: BD.Satoshi, candidates: UTXO.WitnessInput[]): UTXO.WitnessInput {
    const sorted = candidates.sort((x, y) => x.witnessUtxo.value - y.witnessUtxo.value);
    const cost = target.plus(this.costPerInput());
    for (const candidate of sorted) {
      const inputValue: BD.Satoshi = BD.BigDecimal.satoshi(candidate.witnessUtxo.value);
      if (inputValue.gte(cost)) { return candidate; }
    }
    return sorted[sorted.length - 1];
  }

  private [_totalOutputWithoutChange](): BD.Satoshi {
    return Memoize(this, _totalOutputWithoutChange, () => {
      return this[_outputs]().map((x) => x.value)
        .map((x) => BD.BigDecimal.satoshi(x))
        .reduce((prev, cur) => prev.plus(cur), BD.BigDecimal.zero().toSatoshi());
    });
  }

  changeValue(): BD.Satoshi {
    return Memoize(this, 'changeValue', () => {
      const inputFee = BD.BigDecimal.satoshi(this.costPerInput().multipliedBy(new BigNumber(this.inputUtxos().length)).toNumber(), UNIT.SATOSHI);
      const totalOutput = this[_totalOutputWithoutChange]();
      const multiplier = new BigNumber(this[_outputs]().length);
      const outputFee0 = BD.BigDecimal.satoshi(this.costPerOutput().multipliedBy(multiplier.plus(1)).toNumber(), UNIT.SATOSHI);
      const totalInput = this.totalInputs();
      const headerCost = BD.BigDecimal.satoshi(13 * this.props.feeRate);
      const feeCost = inputFee.plus(headerCost).plus(outputFee0);
      const testChange = totalInput
        .minus(totalOutput)
        .minus(feeCost)
        .integerValue(BigNumber.ROUND_DOWN);
      if (testChange.gt(this.dustThreshold())) {
        return testChange;
      } else {
        const feeCost1 = feeCost.plus(this.costPerOutput());
        return totalInput
        .minus(totalOutput)
        .minus(feeCost1)
        .integerValue(BigNumber.ROUND_DOWN);
      }
    });
  }

  protected abstract $costPerInput(): BD.Satoshi;
  protected abstract $costPerOutput(): BD.Satoshi;

  costPerInput(): BD.Satoshi {
    return Memoize(this, 'costPerInput', () => {
      const normalizedCost = this.$costPerInput().multipliedBy(this.props.feeRate);
      return BD.BigDecimal.satoshi(normalizedCost.toNumber());
    });
  }

  costPerOutput(): BD.Satoshi {
    return Memoize(this, 'costPerOutput', () => {
      const normalizedCost = this.$costPerOutput().multipliedBy(this.props.feeRate);
      return BD.BigDecimal.satoshi(normalizedCost.toNumber());
    });
  }

  gasFee(): BD.Satoshi {
    const totalOutput = this.totalOutputs();
    const totalInput = this.totalInputs();
    return totalInput.minus(totalOutput);
  }

  getLog(): SelectorLog {
    return {
      fee: this.gasFee().toSatoshi().toFixed(0),
      feeRate: this.props.feeRate.toString(),
      input: this.inputLog(),
      output: this.outputLog(),
    };
  }

  inputLog(): InputLog[] {
    return this.inputUtxos().map((iu) => {
      return `${iu.hash.toString('hex')}:${iu.index} => (${iu.witnessUtxo.value})`;
    });
  }

  inputUtxos(): UTXO.WitnessInput[] {
    return Memoize(this, 'inputUtxos', () => {
      const inputs = this[_witnessInput]();
      const txToConsume = new Map<(UTXO.Hash | UTXO.ID | undefined), UTXO.WitnessInput>();
      const outputValues = this[_outputs]().map((x) => BD.BigDecimal.satoshi(x.value));
      const totalOutputNeeded = outputValues.reduce((x, y) => x.plus(y), BD.BigDecimal.satoshi(0));
      const outputSet = new Set([
        ...this.props.outputs,
        { address: '', value: this.costPerOutput() } // assuming extra output which is the change.
      ]);
      const state = {inputAvailable: BD.BigDecimal.satoshi(0), inputConsumed: BD.BigDecimal.satoshi(0) };
      const zeroSat = BD.BigDecimal.satoshi(0, UNIT.SATOSHI);
      for (const _ of inputs) {
        const toBeConsumed = totalOutputNeeded.minus(state.inputAvailable);
        if (outputSet.size === 0) { break; }
        const utxoAvailable = inputs.filter((x) => !txToConsume.has(x.hash));
        const bestCandidate = this[_takeBest](toBeConsumed, utxoAvailable);
        txToConsume.set(bestCandidate.hash, bestCandidate);
        const inputValue = BD.BigDecimal.satoshi(bestCandidate.witnessUtxo.value, UNIT.SATOSHI);
        const inputCost = this.costPerInput();
        let outputTakenThisRound = 0;
        state.inputAvailable = state.inputAvailable.plus(inputValue).minus(inputCost);
        for (const output of outputSet) {
          const outputConsumption = BD.BigDecimal.satoshi(output.value, UNIT.SATOSHI).plus(this.costPerOutput());
          if (state.inputAvailable.lt(state.inputConsumed.plus(outputConsumption))) { break; }
          state.inputConsumed = state.inputConsumed.plus(outputConsumption);
          outputSet.delete(output);
          outputTakenThisRound++;
        }
      }
      if (totalOutputNeeded.minus(state.inputAvailable).gt(zeroSat)) {
        throw new Error(`lacking ${totalOutputNeeded.minus(state.inputAvailable).normalized()} BTC to execute this transaction`);
      }
      const result = Array.from(txToConsume.values());
      return result;
    });
  }

  outputLog(): string[] {
    return this.outputs().map((o) => {
      return `${o.address} => ${o.value}`;
    });
  }

  protected abstract dustThreshold(): BD.Satoshi;

  outputs(): UTXO.TxOutput[] {
    const outputs = this[_outputs]();
    const changeValue = this.changeValue();
    if (changeValue.lt(this.dustThreshold())) { return outputs; }
    return [
      ...outputs,
      {
        address: this.props.changeAddress,
        value: changeValue.value(),
      },
    ];
  }

  psbt(params: { network: bitcoin.networks.Network}): bitcoin.Psbt {
    const psbt = new bitcoin.Psbt(params);
    for (const input of this.inputUtxos()) {
      psbt.addInput({
        ...input,
        hash: p(input.hash),
        index: p(input.index),
      });
    }
    for (const output of this.outputs()) {
      psbt.addOutput({
        ...output,
        address: p(output.address),
      });
    }
    return psbt;
  }

  totalInputs(): BD.Satoshi {
    return Memoize(this, 'totalInputs', () => {
      const inputUtxos = this.inputUtxos();
      const totalInputs = inputUtxos
        .map((x) => BD.BigDecimal.satoshi(x.witnessUtxo.value, UNIT.SATOSHI))
        .reduce((x, y) => x.plus(y), BD.BigDecimal.satoshi(0, UNIT.SATOSHI));
      return totalInputs;
    });
  }

  totalOutputs(): BD.Satoshi {
    return Memoize(this, 'totalOutputs', () => {
      const outputs = this.outputs();
      return outputs.map((o) => BD.BigDecimal.satoshi(o.value, UNIT.SATOSHI)).reduce((prev, cur) => {
        return prev.plus(cur);
      }, BD.BigDecimal.satoshi(0, -8));
    });
  }
}

