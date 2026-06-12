#pragma once
#include "pch.h"
#include "NativeModules.h"
#include <shobjidl.h>
#include <shlobj.h>
#include <fstream>
#include <sstream>
#include <thread>
#include <vector>
#include <string>
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "shell32.lib")

// WinRT HTTP
#include <winrt/Windows.Web.Http.h>
#include <winrt/Windows.Web.Http.Headers.h>
#include <winrt/Windows.Foundation.h>

// ─── Base64 encode ────────────────────────────────────────────────────────────

static std::string FM_Base64Encode(const std::vector<uint8_t>& data) {
    static const char* B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    out.reserve((data.size() + 2) / 3 * 4);
    size_t i = 0;
    for (; i + 2 < data.size(); i += 3) {
        uint32_t v = ((uint32_t)data[i] << 16) | ((uint32_t)data[i+1] << 8) | data[i+2];
        out += B64[(v >> 18) & 63]; out += B64[(v >> 12) & 63];
        out += B64[(v >> 6)  & 63]; out += B64[v & 63];
    }
    if (i < data.size()) {
        uint32_t v = (uint32_t)data[i] << 16;
        if (i + 1 < data.size()) v |= (uint32_t)data[i+1] << 8;
        out += B64[(v >> 18) & 63]; out += B64[(v >> 12) & 63];
        out += (i + 1 < data.size()) ? B64[(v >> 6) & 63] : '=';
        out += '=';
    }
    return out;
}

// ─── Base64 decode ────────────────────────────────────────────────────────────

static std::vector<uint8_t> FM_Base64Decode(const std::string& input) {
    static const int T[256] = {
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,
        52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,
        -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
        15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,
        -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
        41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
        -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    };
    std::vector<uint8_t> out;
    out.reserve(input.size() * 3 / 4);
    int val = 0, valb = -8;
    for (unsigned char c : input) {
        int t = T[c];
        if (t == -1) continue;
        val = (val << 6) | t;
        valb += 6;
        if (valb >= 0) {
            out.push_back(static_cast<uint8_t>((val >> valb) & 0xFF));
            valb -= 8;
        }
    }
    return out;
}

// ─── UTF-8 / wide string helpers ──────────────────────────────────────────────

static std::wstring FM_Utf8ToWide(const std::string& s) {
    if (s.empty()) return {};
    int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0);
    std::wstring w(n > 0 ? n - 1 : 0, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, w.data(), n);
    return w;
}

static std::string FM_WideToUtf8(const std::wstring& w) {
    if (w.empty()) return {};
    int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, nullptr, 0, nullptr, nullptr);
    std::string s(n > 0 ? n - 1 : 0, '\0');
    WideCharToMultiByte(CP_UTF8, 0, w.c_str(), -1, s.data(), n, nullptr, nullptr);
    return s;
}

// JSON-safe string escape
static std::string FM_JsonEscape(const std::string& s) {
    std::string r;
    r.reserve(s.size() + 16);
    for (unsigned char c : s) {
        switch (c) {
            case '"':  r += "\\\""; break;
            case '\\': r += "\\\\"; break;
            case '\n': r += "\\n";  break;
            case '\r': r += "\\r";  break;
            case '\t': r += "\\t";  break;
            default:
                if (c < 0x20) { r += ' '; }
                else          { r += c;   }
        }
    }
    return r;
}

// ─── Native module ─────────────────────────────────────────────────────────────
//
//  JS name: RNCWindowsFileManager
//  Methods:
//    saveFile(filename, content)        → Promise<string (saved path)>
//    openFilePicker(extensions[])       → Promise<string (JSON: {name, content})>
//
//  Both methods spin a detached STA thread (required for IFileDialog COM dialogs).
//  The dialog blocks inside the thread; the main RN thread is never blocked.

REACT_MODULE(RNCWindowsFileManager)
struct RNCWindowsFileManager {

    // ── saveFile ──────────────────────────────────────────────────────────────
    REACT_METHOD(saveFile)
    void saveFile(
        std::string filename,
        std::string content,
        winrt::Microsoft::ReactNative::ReactPromise<std::string> promise
    ) noexcept {
        std::thread([
            filename  = std::move(filename),
            content   = std::move(content),
            promise   = std::move(promise)
        ]() mutable {
            HRESULT coInit = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
            bool coInited = SUCCEEDED(coInit) || coInit == S_FALSE;

            IFileSaveDialog* pfd = nullptr;
            HRESULT hr = CoCreateInstance(CLSID_FileSaveDialog, nullptr,
                                          CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&pfd));
            if (FAILED(hr)) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "INIT_ERROR"});
                if (coInited) CoUninitialize();
                return;
            }

            std::wstring wname = FM_Utf8ToWide(filename);
            pfd->SetFileName(wname.c_str());
            pfd->SetOptions(FOS_OVERWRITEPROMPT | FOS_PATHMUSTEXIST);

            // Build extension filter from filename
            std::wstring wext;
            auto dot = wname.rfind(L'.');
            if (dot != std::wstring::npos) wext = wname.substr(dot + 1);
            if (!wext.empty()) {
                std::wstring filterSpec = L"*." + wext;
                std::wstring filterName = wext + L" files";
                COMDLG_FILTERSPEC fs = { filterName.c_str(), filterSpec.c_str() };
                pfd->SetFileTypes(1, &fs);
                pfd->SetDefaultExtension(wext.c_str());
            }

            hr = pfd->Show(nullptr);
            if (hr == HRESULT_FROM_WIN32(ERROR_CANCELLED)) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "CANCELLED"});
                pfd->Release();
                if (coInited) CoUninitialize();
                return;
            }
            if (FAILED(hr)) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "SHOW_ERROR"});
                pfd->Release();
                if (coInited) CoUninitialize();
                return;
            }

            IShellItem* psi = nullptr;
            hr = pfd->GetResult(&psi);
            pfd->Release();
            if (FAILED(hr)) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "RESULT_ERROR"});
                if (coInited) CoUninitialize();
                return;
            }

            PWSTR pszPath = nullptr;
            hr = psi->GetDisplayName(SIGDN_FILESYSPATH, &pszPath);
            psi->Release();
            if (FAILED(hr) || !pszPath) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "PATH_ERROR"});
                if (coInited) CoUninitialize();
                return;
            }

            std::wstring wpath(pszPath);
            CoTaskMemFree(pszPath);

            // Write content as UTF-8
            std::ofstream file(wpath, std::ios::out | std::ios::binary | std::ios::trunc);
            if (!file.is_open()) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "WRITE_ERROR"});
                if (coInited) CoUninitialize();
                return;
            }
            file.write(content.c_str(), (std::streamsize)content.size());
            file.close();

            promise.Resolve(FM_WideToUtf8(wpath));
            if (coInited) CoUninitialize();
        }).detach();
    }

    // ── saveFileBase64 ────────────────────────────────────────────────────────
    // Same as saveFile but decodes base64 content before writing (for binary files like XLSX)
    REACT_METHOD(saveFileBase64)
    void saveFileBase64(
        std::string filename,
        std::string base64Content,
        winrt::Microsoft::ReactNative::ReactPromise<std::string> promise
    ) noexcept {
        std::thread([
            filename     = std::move(filename),
            base64Content = std::move(base64Content),
            promise      = std::move(promise)
        ]() mutable {
            HRESULT coInit = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
            bool coInited = SUCCEEDED(coInit) || coInit == S_FALSE;

            IFileSaveDialog* pfd = nullptr;
            HRESULT hr = CoCreateInstance(CLSID_FileSaveDialog, nullptr,
                                          CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&pfd));
            if (FAILED(hr)) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "INIT_ERROR"});
                if (coInited) CoUninitialize();
                return;
            }

            std::wstring wname = FM_Utf8ToWide(filename);
            pfd->SetFileName(wname.c_str());
            pfd->SetOptions(FOS_OVERWRITEPROMPT | FOS_PATHMUSTEXIST);

            auto dot = wname.rfind(L'.');
            if (dot != std::wstring::npos) {
                std::wstring wext = wname.substr(dot + 1);
                std::wstring filterSpec = L"*." + wext;
                std::wstring filterName = wext + L" files";
                COMDLG_FILTERSPEC fs = { filterName.c_str(), filterSpec.c_str() };
                pfd->SetFileTypes(1, &fs);
                pfd->SetDefaultExtension(wext.c_str());
            }

            hr = pfd->Show(nullptr);
            if (hr == HRESULT_FROM_WIN32(ERROR_CANCELLED)) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "CANCELLED"});
                pfd->Release();
                if (coInited) CoUninitialize();
                return;
            }
            if (FAILED(hr)) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "SHOW_ERROR"});
                pfd->Release();
                if (coInited) CoUninitialize();
                return;
            }

            IShellItem* psi = nullptr;
            hr = pfd->GetResult(&psi);
            pfd->Release();
            if (FAILED(hr)) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "RESULT_ERROR"});
                if (coInited) CoUninitialize();
                return;
            }

            PWSTR pszPath = nullptr;
            hr = psi->GetDisplayName(SIGDN_FILESYSPATH, &pszPath);
            psi->Release();
            if (FAILED(hr) || !pszPath) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "PATH_ERROR"});
                if (coInited) CoUninitialize();
                return;
            }

            std::wstring wpath(pszPath);
            CoTaskMemFree(pszPath);

            auto bytes = FM_Base64Decode(base64Content);

            std::ofstream file(wpath, std::ios::out | std::ios::binary | std::ios::trunc);
            if (!file.is_open()) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "WRITE_ERROR"});
                if (coInited) CoUninitialize();
                return;
            }
            file.write(reinterpret_cast<const char*>(bytes.data()), (std::streamsize)bytes.size());
            file.close();

            promise.Resolve(FM_WideToUtf8(wpath));
            if (coInited) CoUninitialize();
        }).detach();
    }

    // ── httpRequest ───────────────────────────────────────────────────────────
    // method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
    // url, body (JSON string), contentType
    // Returns: JSON string response body
    REACT_METHOD(httpRequest)
    void httpRequest(
        std::string method,
        std::string url,
        std::string body,
        std::string contentType,
        winrt::Microsoft::ReactNative::ReactPromise<std::string> promise
    ) noexcept {
        std::thread([
            method      = std::move(method),
            url         = std::move(url),
            body        = std::move(body),
            contentType = std::move(contentType),
            promise     = std::move(promise)
        ]() mutable {
            try {
                winrt::init_apartment(winrt::apartment_type::multi_threaded);
                winrt::Windows::Web::Http::HttpClient client;
                winrt::Windows::Foundation::Uri uri(FM_Utf8ToWide(url));

                winrt::Windows::Web::Http::HttpResponseMessage response{nullptr};

                if (method == "GET" || method == "DELETE") {
                    winrt::Windows::Web::Http::HttpRequestMessage req(
                        winrt::Windows::Web::Http::HttpMethod{FM_Utf8ToWide(method)},
                        uri
                    );
                    response = client.SendRequestAsync(req).get();
                } else {
                    std::wstring wContentType = FM_Utf8ToWide(contentType.empty() ? "application/json" : contentType);
                    winrt::Windows::Web::Http::HttpStringContent content(
                        FM_Utf8ToWide(body),
                        winrt::Windows::Storage::Streams::UnicodeEncoding::Utf8,
                        wContentType
                    );
                    if (method == "POST") {
                        response = client.PostAsync(uri, content).get();
                    } else if (method == "PUT") {
                        response = client.PutAsync(uri, content).get();
                    } else {
                        winrt::Windows::Web::Http::HttpRequestMessage req(
                            winrt::Windows::Web::Http::HttpMethod{FM_Utf8ToWide(method)},
                            uri
                        );
                        req.Content(content);
                        response = client.SendRequestAsync(req).get();
                    }
                }

                auto responseBody = response.Content().ReadAsStringAsync().get();
                promise.Resolve(FM_WideToUtf8(responseBody.c_str()));
            } catch (winrt::hresult_error const& ex) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{
                    .Message = FM_WideToUtf8(ex.message().c_str())
                });
            } catch (...) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "HTTP_ERROR"});
            }
        }).detach();
    }

    // ── openFilePicker ────────────────────────────────────────────────────────
    REACT_METHOD(openFilePicker)
    void openFilePicker(
        std::vector<std::string> extensions,
        winrt::Microsoft::ReactNative::ReactPromise<std::string> promise
    ) noexcept {
        std::thread([
            extensions = std::move(extensions),
            promise    = std::move(promise)
        ]() mutable {
            HRESULT coInit = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE);
            bool coInited = SUCCEEDED(coInit) || coInit == S_FALSE;

            IFileOpenDialog* pfd = nullptr;
            HRESULT hr = CoCreateInstance(CLSID_FileOpenDialog, nullptr,
                                          CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&pfd));
            if (FAILED(hr)) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "INIT_ERROR"});
                if (coInited) CoUninitialize();
                return;
            }

            pfd->SetOptions(FOS_FILEMUSTEXIST | FOS_PATHMUSTEXIST);

            // Build filter from extensions
            if (!extensions.empty()) {
                std::wstring spec, nameStr;
                for (const auto& ext : extensions) {
                    std::wstring wext = FM_Utf8ToWide(ext);
                    if (!spec.empty())    spec    += L";";
                    if (!nameStr.empty()) nameStr += L", ";
                    spec    += L"*." + wext;
                    nameStr += L"." + wext;
                }
                COMDLG_FILTERSPEC fs = { nameStr.c_str(), spec.c_str() };
                pfd->SetFileTypes(1, &fs);
            }

            hr = pfd->Show(nullptr);
            if (hr == HRESULT_FROM_WIN32(ERROR_CANCELLED)) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "CANCELLED"});
                pfd->Release();
                if (coInited) CoUninitialize();
                return;
            }
            if (FAILED(hr)) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "SHOW_ERROR"});
                pfd->Release();
                if (coInited) CoUninitialize();
                return;
            }

            IShellItem* psi = nullptr;
            hr = pfd->GetResult(&psi);
            pfd->Release();
            if (FAILED(hr)) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "RESULT_ERROR"});
                if (coInited) CoUninitialize();
                return;
            }

            PWSTR pszPath = nullptr;
            hr = psi->GetDisplayName(SIGDN_FILESYSPATH, &pszPath);
            psi->Release();
            if (FAILED(hr) || !pszPath) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "PATH_ERROR"});
                if (coInited) CoUninitialize();
                return;
            }

            std::wstring wpath(pszPath);
            CoTaskMemFree(pszPath);

            // Filename only
            auto slash = wpath.rfind(L'\\');
            std::wstring wname = (slash != std::wstring::npos) ? wpath.substr(slash + 1) : wpath;
            std::string name = FM_WideToUtf8(wname);

            // Read file as bytes and return base64-encoded content
            std::ifstream file(wpath, std::ios::in | std::ios::binary);
            if (!file.is_open()) {
                promise.Reject(winrt::Microsoft::ReactNative::ReactError{.Message = "READ_ERROR"});
                if (coInited) CoUninitialize();
                return;
            }
            std::vector<uint8_t> bytes((std::istreambuf_iterator<char>(file)),
                                        std::istreambuf_iterator<char>());
            file.close();

            std::string b64content = FM_Base64Encode(bytes);
            std::string path_utf8  = FM_WideToUtf8(wpath.c_str());
            std::string json = "{\"name\":\"" + FM_JsonEscape(name) +
                               "\",\"path\":\"" + FM_JsonEscape(path_utf8) +
                               "\",\"content\":\"" + b64content +
                               "\",\"isBase64\":true}";
            promise.Resolve(json);
            if (coInited) CoUninitialize();
        }).detach();
    }
};
