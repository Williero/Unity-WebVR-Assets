/* global SendMessage, THREE */
(function () {
  var btnFsEnter = document.querySelector('#btnFsEnter');
  var btnVrToggle = document.querySelector('#btnVrToggle');
  var btnVrReset = document.querySelector('#btnVrReset');
  var canvas = document.querySelector('#canvas');
  var eyeParamsL;
  var eyeParamsR;
  var fullscreen = new Fullscreen();
  var isDeprecatedAPI = 'getVRDevices' in navigator;
  var isSupported = 'getVRDisplays' in navigator || isDeprecatedAPI;
  var vrDisplay;
  var vrSensor;
  var vrPose;

  if (isSupported) {
    document.body.dataset.supportsVr = 'true';
  }

  btnFsEnter.addEventListener('click', btnFsEnterOnClick);
  btnVrToggle.addEventListener('click', btnVrToggleOnClick);
  btnVrReset.addEventListener('click', btnVrResetOnClick);

  function btnFsEnterOnClick () {
    // FYI: Unity's `SetFullscreen` doesn't call the unprefixed Fullscreen API.
    fullscreen.enter(canvas);
  }

  function btnVrToggleOnClick () {
    btnVrToggle.blur();
    if (vrDisplay) {
      togglePresent();
    } else {
      console.warn('[vrToggle] No VR device was detected');
    }
  }

  function btnVrResetOnClick () {
    btnVrReset.blur();
    if (vrDisplay) {
      resetPose();
    } else {
      console.warn('[btnVrResetOnClick] No VR device was detected');
    }
  }

  function initUnityLoaded () {
    document.body.dataset.unityLoaded = 'true';
  }

  function initVrLoaded () {
    if (isDeprecatedAPI || vrDisplay.capabilities.canPresent) {
      document.body.dataset.vrLoaded = 'true';
    }
  }

  function initVrEventListeners () {
    if (isDeprecatedAPI) {
      document.addEventListener(fullscreen.eventChange, modeChange);
    } else {
      window.addEventListener('vrdisplaypresentchange', modeChange);
    }
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('beforeunload', exitPresent);
  }

  function Fullscreen (element) {
    element = element || document.body;
    this.isSupported = true;
    if (element.requestFullscreen) {
      this.element = 'fullscreenElement';
      this.eventChange = 'fullscreenchange';
      this.methodEnter = 'requestFullscreen';
      this.methodExit = 'exitFullscreen';
    } else if (element.mozRequestFullScreen) {
      this.element = 'mozFullScreenElement';
      this.eventChange = 'mozfullscreenchange';
      this.methodEnter = 'mozRequestFullScreen';
      this.methodExit = 'mozCancelFullScreen';
    } else if (element.webkitRequestFullscreen) {
      this.element = 'webkitFullscreenElement';
      this.eventChange = 'webkitfullscreenchange';
      this.methodEnter = 'webkitRequestFullscreen';
      this.methodExit = 'webkitExitFullscreen';
    } else if (element.msRequestFullscreen) {
      this.element = 'msFullscreenElement';
      this.eventChange = 'MSFullscreenChange';
      this.methodEnter = 'msRequestFullscreen';
      this.methodExit = 'msExitFullscreen';
    } else {
      this.isSupported = false;
    }
    this.isPresenting = function () {
      return !!document[this.element];
    }.bind(this);
    this.enter = function (element, options) {
      return element[this.methodEnter](options);
    }.bind(this);
    this.exit = function () {
      return document[this.methodExit]();
    }.bind(this);
  }

  function raf (cb) {
    if (!vrDisplay) {
      return;
    }
    if (vrDisplay.requestAnimationFrame) {
      return vrDisplay.requestAnimationFrame(cb);
    } else {
      return window.requestAnimationFrame(cb);
    }
  }

  function getDisplays () {
    var filterDevices = function (devices) {
      var device;
      for (var i = 0; i < devices.length; i++) {
        device = devices[i];
        if (!vrDisplay && 'VRDisplay' in window && device instanceof window.VRDisplay) {
          vrDisplay = vrSensor = device;
          break;  // Use the first display we encounter.
        } else if (!vrDisplay && 'HMDVRDevice' in window && device instanceof window.HMDVRDevice) {
          vrDisplay = device;
          if (vrSensor) {
            break;
          }
        } else if (!vrSensor && 'PositionSensorVRDevice' in window && device instanceof window.PositionSensorVRDevice) {
          vrSensor = device;
          if (vrDisplay) {
            break;
          }
        }
      }

      return vrDisplay;
    };

    if (navigator.getVRDisplays) {
      isSupported = true;
      return navigator.getVRDisplays().then(filterDevices);
    } else if (navigator.getVRDevices) {
      isSupported = true;
      isDeprecatedAPI = true;
      return navigator.getVRDevices().then(filterDevices);
    } else {
      throw 'Your browser is not VR ready';
    }
  }

  function getEyeParameters () {
    if (!vrDisplay) {
      console.warn('[getEyeParameters] No VR device was detected');
      return;
    }
    eyeParamsL = vrDisplay.getEyeParameters('left');
    eyeParamsR = vrDisplay.getEyeParameters('right');

    var eyeTranslationL = isDeprecatedAPI ? eyeParamsL.eyeTranslation.x : eyeParamsL.offset[0];
    var eyeTranslationR = isDeprecatedAPI ? eyeParamsR.eyeTranslation.x : eyeParamsR.offset[0];
    var eyeFOVL = isDeprecatedAPI ? eyeParamsL.recommendedFieldOfView : eyeParamsL.fieldOfView;
    var eyeFOVR = isDeprecatedAPI ? eyeParamsR.recommendedFieldOfView : eyeParamsR.fieldOfView;

    SendMessage('WebVRCameraSet', 'eyeL_translation_x', eyeTranslationL);
    SendMessage('WebVRCameraSet', 'eyeR_translation_x', eyeTranslationR);
    SendMessage('WebVRCameraSet', 'eyeL_fovUpDegrees', eyeFOVL.upDegrees);
    SendMessage('WebVRCameraSet', 'eyeL_fovDownDegrees', eyeFOVL.downDegrees);
    SendMessage('WebVRCameraSet', 'eyeL_fovLeftDegrees', eyeFOVL.leftDegrees);
    SendMessage('WebVRCameraSet', 'eyeL_fovRightDegrees', eyeFOVL.rightDegrees);
    SendMessage('WebVRCameraSet', 'eyeR_fovUpDegrees', eyeFOVR.upDegrees);
    SendMessage('WebVRCameraSet', 'eyeR_fovDownDegrees', eyeFOVR.downDegrees);
    SendMessage('WebVRCameraSet', 'eyeR_fovLeftDegrees', eyeFOVR.leftDegrees);
    SendMessage('WebVRCameraSet', 'eyeR_fovRightDegrees', eyeFOVR.rightDegrees);
  }

  function togglePresent () {
    if (isPresenting()) {
      return exitPresent();
    } else {
      return requestPresent();
    }
  }

  function resetPose () {
    if (isDeprecatedAPI) {
      return vrSensor.resetSensor();
    } else {
      return vrDisplay.resetPose();
    }
  }

  function getPose () {
    if (isDeprecatedAPI) {
      return vrSensor.getState();
    } else {
      return vrDisplay.getPose();
    }
  }

  function requestPresent () {
    if (isDeprecatedAPI) {
      return fullscreen.enter(canvas, {vrDisplay: vrDisplay});
    } else {
      return vrDisplay.requestPresent([{source: canvas}]);
    }
  }

  function exitPresent () {
    if (isDeprecatedAPI) {
      return fullscreen.exit();
    } else {
      return vrDisplay.exitPresent();
    }
  }

  function isPresenting () {
    if (!vrDisplay) {
      return false;
    }
    if (isDeprecatedAPI) {
      return fullscreen.isPresenting();
    } else {
      return vrDisplay.isPresenting;
    }
  }

  function getVRSensorState () {
    vrPose = getPose();
    if (!vrPose) {
      return;
    }
    var quaternion = isDeprecatedAPI ? vrPose.orientation : new THREE.Quaternion().fromArray(vrPose.orientation);
    var euler = new THREE.Euler().setFromQuaternion(quaternion);
    SendMessage('WebVRCameraSet', 'euler_x', euler.x);
    SendMessage('WebVRCameraSet', 'euler_y', euler.y);
    SendMessage('WebVRCameraSet', 'euler_z', euler.z);
    if (vrPose.position !== null) {
      var positionX = isDeprecatedAPI ? vrPose.position.x : vrPose.position[0];
      var positionY = isDeprecatedAPI ? vrPose.position.y : vrPose.position[1];
      var positionZ = isDeprecatedAPI ? vrPose.position.z : vrPose.position[2];
      SendMessage('WebVRCameraSet', 'position_x', positionX);
      SendMessage('WebVRCameraSet', 'position_y', positionY);
      SendMessage('WebVRCameraSet', 'position_z', positionZ);
    }
  }

  function resizeCanvas () {
    if (isPresenting()) {
      canvas.width = Math.max(eyeParamsL.renderWidth, eyeParamsR.renderWidth) * 2;
      canvas.height = Math.max(eyeParamsL.renderHeight, eyeParamsR.renderHeight);
    } else {
      revertCanvas();
    }
  }

  function revertCanvas () {
    canvas.width = document.body.dataset.unityWidth;
    canvas.height = document.body.dataset.unityHeight;
  }

  function modeChange (e) {
    if (isPresenting()) {
      SendMessage('WebVRCameraSet', 'changeMode', 'vr');
      btnVrToggle.textContent = btnVrToggle.title = btnVrToggle.dataset.exitVrTitle;
    } else {
      SendMessage('WebVRCameraSet', 'changeMode', 'normal');
      btnVrToggle.textContent = btnVrToggle.title = btnVrToggle.dataset.enterVrTitle;
    }
    resizeCanvas();
  }

  // Post-render callback from Unity.
  window.postRender = function () {
    if (!isDeprecatedAPI && isPresenting()) {
      vrDisplay.submitFrame(vrPose);
    }
  };

  // Initialisation callback from Unity (called by `StereoCamera.cs`).
  window.vrInit = function () {
    initUnityLoaded();
    if (!isSupported) {
      // Bail early in case browser lacks Promises support (for below).
      console.warn('WebVR is not supported');
      return;
    }
    getDisplays().then(function () {
      initVrLoaded();
      initVrEventListeners();
      getEyeParameters();
      resizeCanvas();
      window.requestAnimationFrame(update);
    }).catch(console.error.bind(console));
  };

  var update = function () {
    getVRSensorState();
    raf(update);
  };
})();
