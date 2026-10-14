// One shared configuration for direct SP1 sources; historical standards stay intact.
export const DIRECT_AUTHORING_CONTRACT=Object.freeze({
  version:'direct-authoring-20261012',
  imageMinimum:3,
  imageReviewKeys:Object.freeze(['src','alt','role','composition','sourcePage','author','license','visualChecked']),
  emphasisMinimums:Object.freeze({bold:18,highlight:8,underline:2}),
  foodEmphasisMinimums:Object.freeze({bold:25,highlight:12,underline:8}),
  coreHeadingMaximum:6,
});
export const isDirectSource=source=>source?.contentStandard==='SP1'&&source?.id?.startsWith('direct-');
export const hasAuthoritativePreflight=(env=process.env)=>env.GITHUB_ACTIONS==='true'&&/^[a-f0-9]{40}$/i.test(env.GITHUB_SHA||'')&&env.AUTHORITATIVE_PREFLIGHT_SHA===env.GITHUB_SHA;
