import { loadUpdates } from './update-core.mjs';
import { renderEditorialPost, EDITORIAL_TEMPLATE_VERSION } from './editorial.mjs';
import { assertImageReview } from './image-review.mjs';

try{
  const updates=await loadUpdates();
  for(const update of updates){ if(update.imageReview) assertImageReview(update); renderEditorialPost(update); }
  console.log(`PASS_UPDATE_SOURCE: ${updates.length} updates validated; editorial=${EDITORIAL_TEMPLATE_VERSION}.`);
}catch(error){
  const code=/^E_[A-Z_]+$/.test(error?.message??'')?error.message:'E_UPDATE_VALIDATE_RUNTIME';
  console.error('FAIL_UPDATE_SOURCE: '+code);
  process.exitCode=1;
}
