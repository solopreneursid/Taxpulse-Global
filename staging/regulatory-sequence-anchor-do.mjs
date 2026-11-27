import {DurableObject} from 'cloudflare:workers';
import {initializeSequenceAnchor,readSequenceAnchor,advanceSequenceAnchor,mirrorSequenceFloor} from '../engine/regulatory-sequence-anchor.mjs';

export class RegulatorySequenceAnchor extends DurableObject {
 constructor(ctx,env){
  super(ctx,env);
  ctx.blockConcurrencyWhile(async()=>initializeSequenceAnchor(ctx.storage.sql));
 }
 getState(){
  return readSequenceAnchor(this.ctx.storage.sql);
 }
 async advance(input){
  const result=advanceSequenceAnchor(this.ctx.storage.sql,input);
  if(result.conflict)throw Error('sequence_anchor_conflict');
  await mirrorSequenceFloor(this.env.RULE_SEQUENCE_FLOOR,result.state.sequence);
  return result.state;
 }
}
