import { tick,validateQueue } from './update-queue-core.mjs';
import { QueueRepository } from './update-queue-github.mjs';
import { produceUpdate } from './update-producer.mjs';
const repo=new QueueRepository();
const queue=validateQueue(await repo.read('automation/content-update-queue.json'));
const result=await tick({queue,repo,produce:produceUpdate,runId:process.env.GITHUB_RUN_ID});
console.log(JSON.stringify(result));
if(process.env.GITHUB_STEP_SUMMARY) {
  const {appendFile}=await import('node:fs/promises');
  await appendFile(process.env.GITHUB_STEP_SUMMARY,`Queue: **${result.status}**\n\n${result.itemId??''} ${result.error??result.reason??result.url??''}\n`);
}
