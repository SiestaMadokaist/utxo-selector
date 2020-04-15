import { Memoize } from '@cryptoket/ts-memoize';
import BigNumber from 'bignumber.js';
import * as bitcoin from 'bitcoinjs-lib';
import { AbstractSelector, p, SelectorConfig, SelectorConstructor } from './modules/AbstractSelector';
import { BD } from './modules/BigDecimal';
import { UTXO, } from './types';

export function UTXOSelector(config: SelectorConfig): SelectorConstructor {
  const $costPerInput = BD.BigDecimal.satoshi(config.inputByteSize);
  const $costPerOutput = BD.BigDecimal.satoshi(config.outputByteSize);
  const dustThreshold = BD.BigDecimal.satoshi(config.dustThreshold);

  class Selector extends AbstractSelector {
    protected $costPerInput(): BD.Satoshi { return $costPerInput; }
    protected $costPerOutput(): BD.Satoshi { return $costPerOutput; }
    protected dustThreshold(): BD.Satoshi { return dustThreshold; }
  }

  return Selector;

}

export const BIP84Calculator = UTXOSelector({
  inputByteSize: p(67.9),
  outputByteSize: p(32.2),
  dustThreshold: p(100),
});
