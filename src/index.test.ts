import * as bitcoin from 'bitcoinjs-lib';
import { expect } from 'chai';
import $debug from 'debug';
import utils from 'util';
import { P2WPKHCalculator } from '.';
import { BD } from './modules/BigDecimal';
// import { BIP84Calculator, Input, TxOutput, UTXOSelector, WitnessInput } from './types';
import { UTXO } from './types';
const debug = $debug('utxo-selector:test');

Buffer.prototype[utils.inspect.custom as any] = function(this: Buffer): string {
  return `Buffer: ${this.toString('hex')}`;
} as any;
const sampleTxid = '1ccf1459e89abdefd14483d57807fe730ad8197634306e1b2a59d6ed5b0f012e';
const randomHex = () => Math.floor(Math.random() * 16).toString(16);
const network = bitcoin.networks.regtest;
const signer = bitcoin.ECPair.fromWIF('cTGhosGriPpuGA586jemcuH9pE9spwUmneMBmYYzrQEbY92DJrbo', network);
const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: signer.publicKey });

const compareWithVSize = (inputCount: number, outputCount: number) => {
  const address = '2MsK2NdiVEPCjBMFWbjFvQ39mxWPMopp5vp';
  const valuePerInput = 8000;
  const inputs: UTXO.WitnessInput[] = [ ...new Array(inputCount)].map((x) => ({
    index: 0,
    hash: sampleTxid.replace(/\w/g, () => randomHex()),
    witnessUtxo: {
      script: p2wpkh.output as Buffer,
      value: valuePerInput,
    },
  }));
  const outputs: UTXO.TxOutput[] = [ ...new Array(outputCount)].map((x) => ({ address, value: Math.floor(Math.random() * 2000) }));
  const feeRate = 1;
  const calculator = new P2WPKHCalculator({
    changeAddress: address,
    feeRate,
    inputs,
    outputs,
  });
  const psbt = calculator.psbt({ network });
  for (let i = 0; i < calculator.inputUtxos().length; i++) {
    psbt.signInput(i, signer);
  }
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();
  const vsize = tx.virtualSize();
  const gasFee = calculator.gasFee();
  if (process.argv[1] === __filename) { return; }
  const rate = new BD.BigDecimal(gasFee.dividedBy(vsize), 0);
  expect(calculator.changeValue().toNumber()).lte(valuePerInput);
  expect(rate.toNumber()).gte(feeRate);
  expect(rate.toNumber()).lte(feeRate + 1);
  expect(gasFee.mod(1).toNumber()).eq(0);
  debug({ gasFee, rate, vsize, feeRate });
};

if (process.argv[1] === __filename) {
  compareWithVSize(10, 9);
} else {
  describe('UTXOSelect', () => {
    describe('calculator', () => {
      const inputCount = 100;
      for (let outputCount = 1; outputCount <= 50; outputCount++) {
        it(`(${inputCount}, ${outputCount}) create a transactions with a reasonable ratio to the virtualSize`, () => compareWithVSize(inputCount, outputCount));
      }
    });
  });
}
