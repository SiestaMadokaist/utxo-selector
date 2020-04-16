import { Memoize } from '@cryptoket/ts-memoize';
import BigNumber from 'bignumber.js';
import * as bitcoin from 'bitcoinjs-lib';
import { AbstractSelector, p, SelectorConfig, SelectorConstructor } from './modules/AbstractSelector';
import { BD } from './modules/BigDecimal';
import { UTXO, } from './types';

export function UTXOSelector(config: SelectorConfig): SelectorConstructor {
  const $costPerInput = BD.BigDecimal.satoshi(config.inputByteSize);
  const $costPerOutput = BD.BigDecimal.satoshi(config.outputByteSize);
  const dustThreshold = BD.BigDecimal.satoshi($costPerInput.plus($costPerOutput).multipliedBy(1.1));
  const headerCost = BD.BigDecimal.satoshi(config.headerCost);
  class Selector extends AbstractSelector {
    protected headerCost(): BD.Satoshi { return headerCost; }
    protected $costPerInput(): BD.Satoshi { return $costPerInput; }
    protected $costPerOutput(): BD.Satoshi { return $costPerOutput; }
    protected dustThreshold(): BD.Satoshi { return dustThreshold; }
  }

  return Selector;

}

export const P2WPKHCalculator = UTXOSelector({
  inputByteSize: p(67.9),
  outputByteSize: p(32.2),
  headerCost: 13,
});

export const P2MSCalculator = {
  ['P2SH-P2WSH']: (m: number) => UTXOSelector({
    inputByteSize: p(77 + (m * 28)),
    outputByteSize: p(32.2),
    headerCost: 13,
  }),
  ['P2SH']: (m: number) => UTXOSelector({
    inputByteSize: p(55 + (m * 108)),
    outputByteSize: p(32.2),
    headerCost: 25,
  }),
};
