Pod::Spec.new do |s|
  s.name = 'AtepdfPlanner'
  s.version = '0.1.0'
  s.summary = 'Local development planner transport for atepdf'
  s.description = 'Private session pairing and bounded loopback transport. No PDF processing or provider credential.'
  s.license = { :type => 'Proprietary' }
  s.author = 'atepdf'
  s.homepage = 'https://example.invalid/atepdf-local'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
