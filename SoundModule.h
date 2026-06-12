#pragma once
#include "pch.h"
#include <winrt/Microsoft.ReactNative.h>
#include <winrt/Windows.Media.Playback.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Storage.h>

// Native Windows sound player for Marine Safety Manager (ported from MHM).
// Plays Bundle\assets\sounds\<name>.mp3 next to the executable. Call from JS via
// NativeModules.SoundModule.playSound('ship-bell' | 'success' | 'error').
// Add this file to the windows/<App> project and register it in the app's
// ReactPackageProvider (see WINDOWS.md).
REACT_MODULE(SoundModule)
struct SoundModule {

  REACT_METHOD(playSound)
  void playSound(std::string name) noexcept {
    try {
      auto player = winrt::Windows::Media::Playback::MediaPlayer();
      std::wstring wname(name.begin(), name.end());
      // Build path relative to the executable
      wchar_t exePath[MAX_PATH];
      GetModuleFileNameW(NULL, exePath, MAX_PATH);
      std::wstring dir(exePath);
      dir = dir.substr(0, dir.rfind(L'\\'));
      std::wstring fullPath = dir + L"\\Bundle\\assets\\sounds\\" + wname + L".mp3";
      auto uri = winrt::Windows::Foundation::Uri(fullPath);
      auto source = winrt::Windows::Media::Playback::MediaSource::CreateFromUri(uri);
      player.Source(source);
      player.Play();
    } catch (...) {}
  }
};
