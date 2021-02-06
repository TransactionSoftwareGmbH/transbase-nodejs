{
  "targets": [
    {
      "target_name": "copy_tci_lib",
      "type": "none",
      "copies": [
        {
          "conditions": [
            [
              "OS==\"mac\"",
              {
                "files": [
                  ".transbase/tci_sdk/lib/libtci.dylib"
                ]
              }
            ],
            [
              "OS==\"linux\"",
              {
                "files": [
                  ".transbase/tci_sdk/lib/libtci.so"
                ]
              }
            ],
            [
              "OS==\"win\"",
              {
                "files": [
                  ".transbase/tci_sdk/lib/tci.dll"
                ]
              }
            ]
          ],
          "destination": "<(PRODUCT_DIR)"
        }
      ]
    },
    {
      "target_name": "tci",
      "sources": [
        "tci.cpp"
      ],
      "cflags!": [
        "-fno-exceptions"
      ],
      "cflags_cc!": [
        "-fno-exceptions"
      ],
      "cflags_cc": [
        "-std=c++17"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        ".transbase/tci_sdk/include"
      ],
      "library_dirs": [
        ".transbase/tci_sdk/lib"
      ],
      "libraries": [
        "-ltci"
      ],
      "conditions": [
        [
          "OS==\"mac\"",
          {
            "link_settings": {
              "libraries": [
                "-Wl,-rpath,@loader_path"
              ]
            },
            "xcode_settings": {
              "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
              "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
              "CLANG_CXX_LIBRARY": "libc++",
              "MACOSX_DEPLOYMENT_TARGET": "10.7"
            }
          }
        ],
        [
          "OS==\"linux\"",
          {
            "link_settings": {
              "libraries": [
                "-Wl,-rpath,'$$ORIGIN'"
              ]
            }
          }
        ],
        [
          "OS==\"win\"",
          {
            "msvs_settings": {
              "VCCLCompilerTool": {
                "ExceptionHandling": 1,
                "AdditionalOptions": [
                  "-std:c++17"
                ]
              }
            }
          }
        ]
      ]
    }
  ],
  "defines": [
    "NAPI_VERSION=<(napi_build_version)"
  ]
}
