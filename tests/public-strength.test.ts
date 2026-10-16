import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStrength } from '../lib/public-workout/strength-data';
const workout = {id:'owner-workout',start:'2026-10-15T16:30:00Z',end:'2026-10-15T17:00:00Z',score:{strain:13.159}};
const payload = (units='kg') => ({weightlifting_cardio_details:{weightlifting_exercises:{tonnage_units_display:units,exercise_summary:{tonnage_display:'1,000',exercise_card_groups:[{cards:[{exercise_id:'ROW',title_display:'Row',stat_rows:[{volume_display:'12',weight_display:'80'},{volume_display:'10',weight_display:'--'},{volume_display:'--',weight_display:'--'}],avg_hr_display:'99',user_id:'private'}]},{cards:[{exercise_id:'PLANNED',stat_rows:[{volume_display:'--',weight_display:'--'}]}]}]}}}});
test('returns only logged sets in the workout, preserves unknown weights, excludes private fields',()=>{
 const result=normalizeStrength(workout,payload(),'Asia/Shanghai');
 assert.equal(result.date,'2026-10-16');assert.equal(result.duration_min,30);assert.equal(result.strain,13.2);
 assert.equal(result.exercise_count,1);assert.equal(result.set_count,2);
 assert.deepEqual(result.exercises[0].sets,[{reps:12,weight:80,units:'kg'},{reps:10,weight:null,units:'kg'}]);
 assert.ok(!JSON.stringify(result).includes('user_id'));assert.ok(!JSON.stringify(result).includes('avg_hr'));
});
test('converts volume with explicit lb units and refuses unknown units',()=>{
 assert.equal(normalizeStrength(workout,payload('lbs'),'Asia/Shanghai').total_volume_kg,453.6);
 assert.throws(()=>normalizeStrength(workout,payload('stones'),'Asia/Shanghai'),/unit/);
});
