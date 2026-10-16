import { DateTime } from 'luxon';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db';
import { whoopGet, type WhoopPage } from '@/lib/whoop/client';
import { localDayBounds } from '@/lib/whoop/records';
import { PROFILE } from './policy';

export async function publicWorkoutHistory(whoopUserId: string, date: string, timezone: string) {
  const dates = Array.from({length:7},(_,i)=>DateTime.fromISO(date,{zone:timezone}).minus({days:6-i}).toISODate()!);
  const counts = await prisma.$queryRaw<{date:string;count:number}[]>`SELECT local_date::text AS date,count(*)::int AS count FROM public_workout_nudges WHERE profile_slug=${PROFILE} AND local_date BETWEEN ${dates[0]}::date AND ${date}::date GROUP BY local_date`;
  let trained: Set<string> | null = null;
  try {
    const connection = await prisma.whoopConnection.findFirstOrThrow({where:{whoopUserId,status:'active'},select:{id:true},orderBy:{updatedAt:'desc'}});
    const recorded = await unstable_cache(async()=>{
      const found = new Set<string>(); const seen=new Set<string>(); let cursor:string|undefined;
      const start=localDayBounds(dates[0],timezone).start; const end=localDayBounds(date,timezone).end;
      do {
        const page=await whoopGet<WhoopPage<{start:string}>>(connection.id,'/v2/activity/workout',{start,end,limit:'25',...(cursor?{nextToken:cursor}:{})});
        if(!Array.isArray(page.records))throw new Error('Invalid WHOOP records');
        for(const record of page.records){const day=DateTime.fromISO(record.start).setZone(timezone).toISODate();if(day&&dates.includes(day))found.add(day);}
        cursor=page.next_token||undefined;if(cursor&&seen.has(cursor))throw new Error('Repeated cursor');if(cursor)seen.add(cursor);if(seen.size>20)throw new Error('History page limit');
      }while(cursor);
      return [...found];
    },['public-week-v1',connection.id,date,timezone],{revalidate:60})();
    trained=new Set(recorded);
  }catch { /* Failed health reads remain unknown, never a claimed missed day. */ }
  return dates.map(day=>({date:day,nudges:counts.find(row=>row.date===day)?.count??0,trained:trained?trained.has(day):null}));
}
