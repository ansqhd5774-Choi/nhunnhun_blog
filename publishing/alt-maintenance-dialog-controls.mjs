// Observed Tistory DOM: footer buttons are siblings of .publish_editor.
// Exact role/name and visible IDs prevent clicking unrelated controls.
export async function altDialogControl(page,kind){
  if(await page.locator('.publish_editor:visible').count()!==1)throw Error('E_ALT_DIALOG_CONTROL');
  const cancel=kind==='cancel';
  const control=page.getByRole('button',{name:cancel?'취소':'공개 발행',exact:true})
    .and(page.locator(cancel?'#unpublish-btn:visible':'#publish-btn:visible'));
  if(await control.count()!==1||!await control.isEnabled())throw Error(cancel?'E_ALT_CANCEL_CONTROL':'E_ALT_SUBMIT_CONTROL');
  return control;
}
export async function cancelAltDialog(page){
  await (await altDialogControl(page,'cancel')).click();
  await page.locator('.publish_editor').waitFor({state:'hidden',timeout:10000});
}
