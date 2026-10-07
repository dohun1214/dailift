Pod::Spec.new do |s|
  s.name           = 'TextRecognition'
  s.version        = '1.0.0'
  s.summary        = 'On-device text recognition'
  s.description    = 'Reads text from a photo on the device with the Vision framework'
  s.license        = 'MIT'
  s.author         = 'Dailift'
  s.homepage       = 'https://github.com/dohun1214/dailift'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/dohun1214/dailift.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'Vision'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
end
