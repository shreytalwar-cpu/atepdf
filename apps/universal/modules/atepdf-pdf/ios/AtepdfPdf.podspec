Pod::Spec.new do |s|
  s.name = 'AtepdfPdf'
  s.version = '0.1.0'
  s.summary = 'On-device PDF reading for atepdf'
  s.description = 'Independent native PDF validation, raster preview and local image codecs.'
  s.license = { :type => 'Proprietary' }
  s.author = 'atepdf'
  s.homepage = 'https://example.invalid/atepdf-local'
  s.platforms = { :ios => '16.4' }
  s.swift_version = '5.9'
  s.source = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'PDFKit', 'Vision', 'ImageIO'
  s.source_files = '**/*.{h,m,mm,swift}'
end
