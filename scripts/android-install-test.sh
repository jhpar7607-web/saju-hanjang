#!/bin/sh
# 가상 안드로이드 기기에 앱 파일을 실제로 설치해 보는 시험 (깃허브 자동 빌드에서 실행)
# 설치가 실패하면 여기서 멈추고 빌드가 빨간색이 된다.
set -e
PKG=io.github.jhpar7607web.sajuhanjang
APK=$(ls apk/*.apk | head -1)

echo "== 기기 정보"
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk

if [ -f old/saju-hanjang-test.apk ]; then
  echo "== 지난 버전 먼저 설치 (업데이트 설치 시험)"
  adb install old/saju-hanjang-test.apk
  adb shell dumpsys package "$PKG" | grep -E "versionName" | head -1
fi

echo "== 설치 (지난 버전이 있으면 그 위에 업데이트)"
adb install -r "$APK"

echo "== 설치된 앱 확인"
adb shell pm list packages | grep "$PKG"
adb shell dumpsys package "$PKG" | grep -E "versionName|versionCode|targetSdk" | head -3

echo "== 같은 파일을 한 번 더 설치 (덮어 설치 확인)"
adb install -r "$APK"

echo "== 앱 열기 (켜지자마자 꺼지면 여기서 멈춘다)"
adb logcat -c || true
adb logcat -b crash -c || true
adb shell am start -W -n "$PKG/com.google.androidbrowserhelper.trusted.LauncherActivity"
sleep 12
adb shell dumpsys activity activities | grep -E "topResumedActivity|mResumedActivity" | head -2 || true
echo "== 기기에 있는 브라우저"
adb shell pm list packages | grep -E "chrome|browser|webview" || true
echo "== 앱 오류 기록 (없으면 아무것도 나오지 않음)"
adb logcat -d -b crash > crash.txt || true
head -40 crash.txt
if grep -q "Process: $PKG" crash.txt; then
  echo "앱이 실행 중에 꺼졌습니다. 시험 실패."
  exit 1
fi
echo "== 설치와 실행 시험 통과"
