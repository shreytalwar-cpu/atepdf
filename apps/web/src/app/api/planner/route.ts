export async function POST() {
  return Response.json({code:'PLANNER_NOT_CONFIGURED',message:'Hosted AI is not connected. Local actions are available.'},{status:503,headers:{'Cache-Control':'no-store'}});
}
