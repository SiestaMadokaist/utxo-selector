import * as bitcoin from 'bitcoinjs-lib';
import { expect } from 'chai';
import $debug from 'debug';
import utils from 'util';
import { P2WPKHCalculator, P2MSCalculator } from '.';
import { BD } from './modules/BigDecimal';
import { UTXO } from './types';
import { p } from './modules/AbstractSelector';
import { ValidationException } from './helper/errors';
Buffer.prototype[utils.inspect.custom as any] = function(this: Buffer): string {
  return `Buffer: ${this.toString('hex')}`;
} as any;
// tslint:disable-next-line:no-var-requires
const debug = require('debug')('utxo-selector:debug:playground');
// tslint:disable-next-line:no-var-requires
const log = require('debug')('utxo-selector:log:playground');
// const debug = (...args: any[]) => {};
const NETWORK = bitcoin.networks.regtest;
// const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const randomHex = () => Math.floor(Math.random() * 16).toString(16);
const sampleTxid = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const seed = Buffer.from('5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4', 'hex');
const root = bitcoin.bip32.fromSeed(seed, NETWORK);
const master = root.derivePath(`m/49'/0'/0'`);

function createNonWitnessUTXO(address: string, value: number, outputCount: number = 1): { nonWitnessUtxo: UTXO.NonWitnessUTXO, hash: Buffer } {
  const prevPsbt = new bitcoin.Psbt({ network: NETWORK });
  const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: master.publicKey, network: NETWORK });
  prevPsbt.addInput({
    index: 0,
    hash: sampleTxid.replace(/\w/g, () => randomHex()),
    witnessUtxo: {
      script: p2wpkh.output as Buffer,
      value: (value + 1000) * outputCount,
    },
  });
  for (let i = 0; i < outputCount; i++) {
    prevPsbt.addOutput({
      address: address as string,
      value,
    });
  }
  prevPsbt.signAllInputs(master);
  const validated = prevPsbt.validateSignaturesOfAllInputs();
  if (!validated) { throw new ValidationException(`signature doesnt match`); }
  prevPsbt.finalizeAllInputs();
  const tx = prevPsbt.extractTransaction();
  return { nonWitnessUtxo: tx.toBuffer(), hash: tx.getHash() };
}

describe('same-hash', () => {
  it('can create psbt', () => {
    const signer = master.derive(0);
    const { publicKey } = signer;
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: publicKey, network: NETWORK });
    const address = p2wpkh.address as string;
    const nonWitnessUtxo = createNonWitnessUTXO(address, 10000, 2);
    const feeRate = 2;
    const calculator = new P2WPKHCalculator({
      changeAddress: address,
      feeRate,
      inputs: [
        {
          ...nonWitnessUtxo,
          index: 0,
        },
        {
          ...nonWitnessUtxo,
          index: 1,
        }
      ],
      outputs: [ { address, value: 9999 }]
    });
    const psbt = calculator.psbt({ network: NETWORK });
    psbt.signAllInputs(signer);
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const rate = psbt.getFee() / tx.virtualSize();
    debug(tx);
    debug({ vsize: tx.virtualSize(), gasFee: psbt.getFee(), feeRateRequest: feeRate, rate });
    expect(tx.ins[0].hash.toString('hex')).to.eq(tx.ins[1].hash.toString('hex'));
  });
});
