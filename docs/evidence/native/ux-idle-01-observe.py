# Public-tool observer; no app/test mutations or private quiescence controls.
import pathlib,time,subprocess,os,json,datetime,concurrent.futures
log=pathlib.Path('.build/ux-idle-01.log');env=dict(os.environ,DEVELOPER_DIR='/Applications/Xcode-beta.app/Contents/Developer')
started=time.monotonic();last_text='';changed=started
while time.monotonic()-started<60:
 text=log.read_text()
 if text!=last_text:changed=time.monotonic();last_text=text
 if 'Tap "Close preview" Button' in text and time.monotonic()-changed>5 and 'Test Suite' not in text[text.rfind('Tap "Close preview" Button'):]:
  stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
  processes=[]
  for pid,name in [(52402,'app'),(52340,'runner')]:
   proc=subprocess.check_output(['ps','-p',str(pid),'-o','pid=,ppid=,etime=,%cpu=,command='],text=True).strip()
   assert '/526CAD4B-89C5-49C1-8CEE-F65602AA0DEE/' in proc
   processes.append({'pid':pid,'kind':name,'process':proc})
  record={'capturedAt':stamp,'reason':'No test log progress for >5s after Close preview idle wait','tail':text[-1900:],'processes':processes}
  pathlib.Path('docs/evidence/native/ux-idle-01-wait-window.json').write_text(json.dumps(record,indent=2)+'\n')
  def sample(p):return subprocess.run(['sample',str(p['pid']),'3','-file','docs/evidence/native/ux-idle-01-'+p['kind']+'-during-wait.sample.txt'],capture_output=True,text=True).returncode
  with concurrent.futures.ThreadPoolExecutor() as pool:
   futures=[pool.submit(sample,p) for p in processes]
   for i in range(2):
    subprocess.run(['xcrun','simctl','io','526CAD4B-89C5-49C1-8CEE-F65602AA0DEE','screenshot','docs/evidence/native/ux-idle-01-during-wait-'+str(i)+'.png'],env=env,capture_output=True,check=True)
    time.sleep(1)
   record['sampleExitCodes']=[f.result() for f in futures]
  record['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
  pathlib.Path('docs/evidence/native/ux-idle-01-wait-window.json').write_text(json.dumps(record,indent=2)+'\n')
  print(json.dumps(record,indent=2));break
 if '** TEST EXECUTE' in text:print('Run ended without observed wait');break
 time.sleep(.5)
else:print('Observation window ended, test not restarted')
