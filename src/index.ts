import { UTXO, } from './types';
import { Memoize } from '@cryptoket/ts-memoize';
import { BD } from './modules/BigDecimal';
import * as bitcoin from 'bitcoinjs-lib';
import BigNumber from 'bignumber.js';
import { SelectorConfig, SelectorConstructor, AbstractSelector, p } from './modules/AbstractSelector';

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
