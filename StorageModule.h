#pragma once
#include "pch.h"
#include "NativeModules.h"
#pragma comment(lib, "advapi32.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "Crypt32.lib")

#include <string>
#include <vector>
#include <mutex>
#include <fstream>
#include <cstdio>
#include <shobjidl_core.h>
#include <wincrypt.h>

// Persistent key-value storage via Windows Registry (HKCU).
// Replaces WinRT ApplicationData.LocalSettings which requires
// Windows.Storage contract — not available with MinimalCoreWin=true
// and throws SEH exceptions from MTA threads (bypasses catch(...),
// hits noexcept -> std::terminate -> startup crash).
//
// Data lives at: HKCU\Software\MSMWindows\Storage
// Values: REG_SZ, UTF-16. Supports arbitrary size (up to registry limit ~1 MB).

static constexpr const wchar_t* STORAGE_REG_PATH = L"Software\\MSMWindows\\Storage";

namespace StorageImpl {

inline std::wstring ToWide(const std::string& s) {
    if (s.empty()) return {};
    int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), nullptr, 0);
    std::wstring w(n, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), w.data(), n);
    return w;
}

inline std::string ToUtf8(const wchar_t* w) {
    if (!w || !*w) return {};
    int n = WideCharToMultiByte(CP_UTF8, 0, w, -1, nullptr, 0, nullptr, nullptr);
    std::string s(n - 1, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w, -1, s.data(), n, nullptr, nullptr);
    return s;
}

inline std::mutex& Mutex() {
    static std::mutex m;
    return m;
}

inline std::string Get(const std::wstring& key) {
    DWORD cbData = 0;
    LSTATUS st = RegGetValueW(HKEY_CURRENT_USER, STORAGE_REG_PATH, key.c_str(),
        RRF_RT_REG_SZ, nullptr, nullptr, &cbData);
    if (st == ERROR_FILE_NOT_FOUND || st == ERROR_PATH_NOT_FOUND) return {};
    if (cbData == 0) return {};
    std::vector<wchar_t> buf(cbData / sizeof(wchar_t) + 1);
    st = RegGetValueW(HKEY_CURRENT_USER, STORAGE_REG_PATH, key.c_str(),
        RRF_RT_REG_SZ, nullptr, buf.data(), &cbData);
    return (st == ERROR_SUCCESS) ? ToUtf8(buf.data()) : std::string{};
}

inline LSTATUS Set(const std::wstring& key, const std::wstring& value) {
    return RegSetKeyValueW(HKEY_CURRENT_USER, STORAGE_REG_PATH, key.c_str(),
        REG_SZ, value.c_str(), (DWORD)((value.size() + 1) * sizeof(wchar_t)));
}

inline LSTATUS Remove(const std::wstring& key) {
    LSTATUS st = RegDeleteKeyValueW(HKEY_CURRENT_USER, STORAGE_REG_PATH, key.c_str());
    return (st == ERROR_FILE_NOT_FOUND || st == ERROR_PATH_NOT_FOUND) ? ERROR_SUCCESS : st;
}

inline std::vector<std::string> AllKeys() {
    std::vector<std::string> keys;
    HKEY hKey = nullptr;
    LSTATUS st = RegOpenKeyExW(HKEY_CURRENT_USER, STORAGE_REG_PATH, 0, KEY_READ, &hKey);
    if (st != ERROR_SUCCESS) return keys;
    wchar_t name[16384];
    DWORD nameLen = 16384, idx = 0;
    while (RegEnumValueW(hKey, idx++, name, &nameLen, nullptr, nullptr, nullptr, nullptr)
           == ERROR_SUCCESS) {
        keys.push_back(ToUtf8(name));
        nameLen = 16384;
    }
    RegCloseKey(hKey);
    return keys;
}

inline void Clear() {
    HKEY hKey = nullptr;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, STORAGE_REG_PATH, 0,
                      KEY_ALL_ACCESS, &hKey) != ERROR_SUCCESS) return;
    wchar_t name[16384];
    DWORD nameLen = 16384;
    while (RegEnumValueW(hKey, 0, name, &nameLen, nullptr, nullptr, nullptr, nullptr)
           == ERROR_SUCCESS) {
        RegDeleteValueW(hKey, name);
        nameLen = 16384;
    }
    RegCloseKey(hKey);
}

} // namespace StorageImpl

REACT_MODULE(StorageModule)
struct StorageModule {

    REACT_METHOD(getItem)
    void getItem(
        std::string key,
        winrt::Microsoft::ReactNative::ReactPromise<std::string> promise) noexcept {
        try {
            std::lock_guard<std::mutex> lock(StorageImpl::Mutex());
            promise.Resolve(StorageImpl::Get(StorageImpl::ToWide(key)));
        } catch (const std::exception& e) {
            promise.Reject(e.what());
        } catch (...) {
            promise.Reject("getItem: unknown error");
        }
    }

    REACT_METHOD(setItem)
    void setItem(
        std::string key,
        std::string value,
        winrt::Microsoft::ReactNative::ReactPromise<void> promise) noexcept {
        try {
            std::lock_guard<std::mutex> lock(StorageImpl::Mutex());
            LSTATUS st = StorageImpl::Set(
                StorageImpl::ToWide(key),
                StorageImpl::ToWide(value));
            if (st == ERROR_SUCCESS) {
                promise.Resolve();
            } else {
                promise.Reject(("setItem failed, code=" + std::to_string(st)).c_str());
            }
        } catch (const std::exception& e) {
            promise.Reject(e.what());
        } catch (...) {
            promise.Reject("setItem: unknown error");
        }
    }

    REACT_METHOD(removeItem)
    void removeItem(
        std::string key,
        winrt::Microsoft::ReactNative::ReactPromise<void> promise) noexcept {
        try {
            std::lock_guard<std::mutex> lock(StorageImpl::Mutex());
            LSTATUS st = StorageImpl::Remove(StorageImpl::ToWide(key));
            if (st == ERROR_SUCCESS) {
                promise.Resolve();
            } else {
                promise.Reject(("removeItem failed, code=" + std::to_string(st)).c_str());
            }
        } catch (const std::exception& e) {
            promise.Reject(e.what());
        } catch (...) {
            promise.Reject("removeItem: unknown error");
        }
    }

    REACT_METHOD(clear)
    void clear(
        winrt::Microsoft::ReactNative::ReactPromise<void> promise) noexcept {
        try {
            std::lock_guard<std::mutex> lock(StorageImpl::Mutex());
            StorageImpl::Clear();
            promise.Resolve();
        } catch (const std::exception& e) {
            promise.Reject(e.what());
        } catch (...) {
            promise.Reject("clear: unknown error");
        }
    }

    REACT_METHOD(getAllKeys)
    void getAllKeys(
        winrt::Microsoft::ReactNative::ReactPromise<std::vector<std::string>> promise) noexcept {
        try {
            std::lock_guard<std::mutex> lock(StorageImpl::Mutex());
            promise.Resolve(StorageImpl::AllKeys());
        } catch (const std::exception& e) {
            promise.Reject(e.what());
        } catch (...) {
            promise.Reject("getAllKeys: unknown error");
        }
    }

    // ── File picker (Windows Open dialog) ────────────────────────────────────
    REACT_METHOD(openFilePicker)
    void openFilePicker(
        std::vector<std::string> extensions,
        winrt::Microsoft::ReactNative::ReactPromise<std::string> promise) noexcept {

        struct State {
            std::vector<std::string> exts;
            std::string json;   // empty = cancelled
            std::string error;
            HANDLE ev;
        };
        auto* s = new State{ extensions, {}, {}, CreateEventW(nullptr, TRUE, FALSE, nullptr) };
        if (!s->ev) { promise.Reject("CreateEvent failed"); delete s; return; }

        HANDLE hThread = CreateThread(nullptr, 0, [](LPVOID lp) -> DWORD {
            auto* s = static_cast<State*>(lp);
            CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);

            IFileOpenDialog* dlg = nullptr;
            if (SUCCEEDED(CoCreateInstance(CLSID_FileOpenDialog, nullptr,
                    CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dlg)))) {

                // Build filter spec from extensions list
                std::vector<std::wstring> ss;
                std::vector<COMDLG_FILTERSPEC> fs;
                if (!s->exts.empty()) {
                    std::wstring spec;
                    for (auto& e : s->exts) {
                        if (!spec.empty()) spec += L";";
                        spec += L"*.";
                        spec += std::wstring(e.begin(), e.end());
                    }
                    ss = { L"Supported Files", spec, L"All Files", L"*.*" };
                    fs = { {ss[0].c_str(), ss[1].c_str()}, {ss[2].c_str(), ss[3].c_str()} };
                    dlg->SetFileTypes((UINT)fs.size(), fs.data());
                }

                if (SUCCEEDED(dlg->Show(nullptr))) {
                    IShellItem* item = nullptr;
                    if (SUCCEEDED(dlg->GetResult(&item))) {
                        PWSTR ppath = nullptr;
                        if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &ppath))) {
                            std::wstring wpath(ppath);
                            CoTaskMemFree(ppath);

                            // filename
                            std::wstring wname = wpath.substr(wpath.rfind(L'\\') + 1);

                            // read binary
                            std::ifstream f(wpath, std::ios::binary);
                            if (f.is_open()) {
                                std::string raw((std::istreambuf_iterator<char>(f)), {});
                                f.close();

                                // strip UTF-8 BOM
                                if (raw.size() >= 3 &&
                                    (unsigned char)raw[0] == 0xEF &&
                                    (unsigned char)raw[1] == 0xBB &&
                                    (unsigned char)raw[2] == 0xBF)
                                    raw = raw.substr(3);
                                // convert UTF-16 LE to UTF-8
                                else if (raw.size() >= 2 &&
                                    (unsigned char)raw[0] == 0xFF &&
                                    (unsigned char)raw[1] == 0xFE) {
                                    auto* w = reinterpret_cast<wchar_t*>(raw.data() + 2);
                                    int wn = (int)((raw.size() - 2) / sizeof(wchar_t));
                                    int n = WideCharToMultiByte(CP_UTF8, 0, w, wn, nullptr, 0, nullptr, nullptr);
                                    std::string u(n, '\0');
                                    WideCharToMultiByte(CP_UTF8, 0, w, wn, u.data(), n, nullptr, nullptr);
                                    raw = std::move(u);
                                }

                                // wname -> utf8
                                int nn = WideCharToMultiByte(CP_UTF8, 0, wname.c_str(), -1, nullptr, 0, nullptr, nullptr);
                                std::string name(nn - 1, '\0');
                                WideCharToMultiByte(CP_UTF8, 0, wname.c_str(), -1, name.data(), nn, nullptr, nullptr);

                                // JSON escape
                                auto esc = [](const std::string& x) {
                                    std::string r; r.reserve(x.size());
                                    for (unsigned char c : x) {
                                        if      (c == '"')  r += "\\\"";
                                        else if (c == '\\') r += "\\\\";
                                        else if (c == '\n') r += "\\n";
                                        else if (c == '\r') r += "\\r";
                                        else if (c == '\t') r += "\\t";
                                        else if (c < 0x20) { char b[8]; snprintf(b, 8, "\\u%04x", c); r += b; }
                                        else r += (char)c;
                                    }
                                    return r;
                                };
                                s->json = "{\"name\":\"" + esc(name) + "\",\"content\":\"" + esc(raw) + "\"}";
                            } else {
                                s->error = "Cannot read file";
                            }
                        }
                        item->Release();
                    }
                }
                dlg->Release();
            } else {
                s->error = "Cannot create file dialog";
            }

            CoUninitialize();
            SetEvent(s->ev);
            return 0;
        }, s, 0, nullptr);

        if (!hThread) { promise.Reject("CreateThread failed"); CloseHandle(s->ev); delete s; return; }
        CloseHandle(hThread);
        WaitForSingleObject(s->ev, INFINITE);
        CloseHandle(s->ev);

        if (!s->error.empty()) promise.Reject(s->error.c_str());
        else promise.Resolve(s->json);   // empty string = cancelled
        delete s;
    }

    // ── File save (Windows Save dialog) ──────────────────────────────────────
    REACT_METHOD(saveFile)
    void saveFile(
        std::string filename,
        std::string content,
        winrt::Microsoft::ReactNative::ReactPromise<std::string> promise) noexcept {

        struct State {
            std::string filename;
            std::string content;
            std::string path;   // empty = cancelled
            std::string error;
            HANDLE ev;
        };
        auto* s = new State{ filename, content, {}, {}, CreateEventW(nullptr, TRUE, FALSE, nullptr) };
        if (!s->ev) { promise.Reject("CreateEvent failed"); delete s; return; }

        HANDLE hThread = CreateThread(nullptr, 0, [](LPVOID lp) -> DWORD {
            auto* s = static_cast<State*>(lp);
            CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);

            IFileSaveDialog* dlg = nullptr;
            if (SUCCEEDED(CoCreateInstance(CLSID_FileSaveDialog, nullptr,
                    CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dlg)))) {

                std::wstring wfn(s->filename.begin(), s->filename.end());
                dlg->SetFileName(wfn.c_str());

                if (SUCCEEDED(dlg->Show(nullptr))) {
                    IShellItem* item = nullptr;
                    if (SUCCEEDED(dlg->GetResult(&item))) {
                        PWSTR ppath = nullptr;
                        if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &ppath))) {
                            std::wstring wpath(ppath);
                            CoTaskMemFree(ppath);

                            std::ofstream f(wpath, std::ios::binary);
                            if (f.is_open()) {
                                f.write(s->content.c_str(), (std::streamsize)s->content.size());
                                f.close();
                                int n = WideCharToMultiByte(CP_UTF8, 0, wpath.c_str(), -1, nullptr, 0, nullptr, nullptr);
                                s->path.resize(n - 1);
                                WideCharToMultiByte(CP_UTF8, 0, wpath.c_str(), -1, s->path.data(), n, nullptr, nullptr);
                            } else {
                                s->error = "Cannot write file";
                            }
                        }
                        item->Release();
                    }
                }
                dlg->Release();
            } else {
                s->error = "Cannot create save dialog";
            }

            CoUninitialize();
            SetEvent(s->ev);
            return 0;
        }, s, 0, nullptr);

        if (!hThread) { promise.Reject("CreateThread failed"); CloseHandle(s->ev); delete s; return; }
        CloseHandle(hThread);
        WaitForSingleObject(s->ev, INFINITE);
        CloseHandle(s->ev);

        if (!s->error.empty()) promise.Reject(s->error.c_str());
        else promise.Resolve(s->path);   // empty string = cancelled
        delete s;
    }

    // ── Save base64-encoded binary file (e.g. XLSX) via Save dialog ──────────
    REACT_METHOD(saveBase64File)
    void saveBase64File(
        std::string filename,
        std::string base64content,
        winrt::Microsoft::ReactNative::ReactPromise<std::string> promise) noexcept {

        // Decode base64 → binary bytes before opening the dialog
        DWORD cbBinary = 0;
        if (!CryptStringToBinaryA(base64content.c_str(), (DWORD)base64content.size(),
                CRYPT_STRING_BASE64, nullptr, &cbBinary, nullptr, nullptr) || cbBinary == 0) {
            promise.Reject("saveBase64File: base64 decode failed (size query)");
            return;
        }
        std::vector<BYTE> bytes(cbBinary);
        if (!CryptStringToBinaryA(base64content.c_str(), (DWORD)base64content.size(),
                CRYPT_STRING_BASE64, bytes.data(), &cbBinary, nullptr, nullptr)) {
            promise.Reject("saveBase64File: base64 decode failed");
            return;
        }

        struct State {
            std::string filename;
            std::vector<BYTE> bytes;
            std::string path;
            std::string error;
            HANDLE ev;
        };
        auto* s = new State{ filename, std::move(bytes), {}, {}, CreateEventW(nullptr, TRUE, FALSE, nullptr) };
        if (!s->ev) { promise.Reject("CreateEvent failed"); delete s; return; }

        HANDLE hThread = CreateThread(nullptr, 0, [](LPVOID lp) -> DWORD {
            auto* s = static_cast<State*>(lp);
            CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);

            IFileSaveDialog* dlg = nullptr;
            if (SUCCEEDED(CoCreateInstance(CLSID_FileSaveDialog, nullptr,
                    CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&dlg)))) {

                std::wstring wfn(s->filename.begin(), s->filename.end());
                dlg->SetFileName(wfn.c_str());

                // Filter: Excel files only
                COMDLG_FILTERSPEC fs[] = {
                    { L"Excel Workbook (*.xlsx)", L"*.xlsx" },
                    { L"All Files",               L"*.*"    },
                };
                dlg->SetFileTypes(2, fs);
                dlg->SetDefaultExtension(L"xlsx");

                if (SUCCEEDED(dlg->Show(nullptr))) {
                    IShellItem* item = nullptr;
                    if (SUCCEEDED(dlg->GetResult(&item))) {
                        PWSTR ppath = nullptr;
                        if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &ppath))) {
                            std::wstring wpath(ppath);
                            CoTaskMemFree(ppath);

                            std::ofstream f(wpath, std::ios::binary);
                            if (f.is_open()) {
                                f.write(reinterpret_cast<const char*>(s->bytes.data()),
                                        (std::streamsize)s->bytes.size());
                                f.close();
                                int n = WideCharToMultiByte(CP_UTF8, 0, wpath.c_str(), -1, nullptr, 0, nullptr, nullptr);
                                s->path.resize(n - 1);
                                WideCharToMultiByte(CP_UTF8, 0, wpath.c_str(), -1, s->path.data(), n, nullptr, nullptr);
                            } else {
                                s->error = "Cannot write file";
                            }
                        }
                        item->Release();
                    }
                }
                dlg->Release();
            } else {
                s->error = "Cannot create save dialog";
            }

            CoUninitialize();
            SetEvent(s->ev);
            return 0;
        }, s, 0, nullptr);

        if (!hThread) { promise.Reject("CreateThread failed"); CloseHandle(s->ev); delete s; return; }
        CloseHandle(hThread);
        WaitForSingleObject(s->ev, INFINITE);
        CloseHandle(s->ev);

        if (!s->error.empty()) promise.Reject(s->error.c_str());
        else promise.Resolve(s->path);
        delete s;
    }
};
