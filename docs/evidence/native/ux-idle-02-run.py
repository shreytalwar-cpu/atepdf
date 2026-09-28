# Diagnostic-only host harness, generated for the unchanged captured XCTest.
# Uses public simctl settings + xcodebuild. Restores the original text-size value.
import subprocess, pathlib, os, json, datetime, hashlib
root=pathlib.Path('/Users/shrey/Documents/ChatGPT/atepdf');os.chdir(root)
env=dict(os.environ,DEVELOPER_DIR='/Applications/Xcode-beta.app/Contents/Developer')
device='526CAD4B-89C5-49C1-8CEE-F65602AA0DEE'
run=lambda args:subprocess.check_output(args,text=True,env=env).strip()
original=run(['xcrun','simctl','ui',device,'content_size'])
assert original in ['large','accessibility-large'],original
state={'device':device,'originalTextSize':original,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'product':'.build/ux-discovery-final-products/atepdfUI_iphonesimulator27.0-arm64.xctestrun','purpose':'One unchanged AX-landscape reproduction with process sampling during any idle wait','sourceCommit':'7935daa9ec3af260b65650a97ef719fe1001db42'}
path=pathlib.Path('docs/evidence/native/ux-idle-02-runtime.json')
assert not path.exists()
try:
 subprocess.run(['xcrun','simctl','ui',device,'content_size','accessibility-large'],env=env,check=True)
 cmd=['xcodebuild','test-without-building','-xctestrun',state['product'],'-destination','platform=iOS Simulator,id='+device,'-parallel-testing-enabled','NO','-only-testing:atepdfUITests/AtepdfWorkflowUITests/testIPadLandscapeKeyboardAndPreview','-resultBundlePath','.build/ux-idle-02.xcresult']
 with open('.build/ux-idle-02.log','w') as out:
  proc=subprocess.Popen(cmd,env=env,stdout=out,stderr=subprocess.STDOUT)
  state['xcodebuildPID']=proc.pid;path.write_text(json.dumps(state,indent=2)+'\n')
  state['exitCode']=proc.wait()
finally:
 subprocess.run(['xcrun','simctl','ui',device,'content_size',original],env=env,check=True)
 state['restoredTextSize']=run(['xcrun','simctl','ui',device,'content_size'])
 state['finishedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 path.write_text(json.dumps(state,indent=2)+'\n')
print(json.dumps(state,indent=2))
