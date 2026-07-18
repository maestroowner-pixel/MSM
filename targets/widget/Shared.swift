// The flagged snapshot, as the app writes it and the widget reads it.
//
// The app (services/widgetBridge.ts → ExtensionStorage) writes a JSON STRING of
// `[{ id, name, sub }]` into this App Group's UserDefaults under `msmFlaggedKey`.
// The widget process cannot see the app's live data, so this is its only source
// of truth — and it must stay in step with widgets/shared.ts on the JS side.

import Foundation

let msmAppGroup = "group.com.kukalab.msm"
let msmFlaggedKey = "msm.widget.flagged"

struct FlaggedItem: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let sub: String
}

/// The flagged items the app last exported, or an empty list if nothing has been
/// written yet (first launch, or no flagged items).
func loadFlagged() -> [FlaggedItem] {
    guard
        let defaults = UserDefaults(suiteName: msmAppGroup),
        let raw = defaults.string(forKey: msmFlaggedKey),
        let data = raw.data(using: .utf8),
        let items = try? JSONDecoder().decode([FlaggedItem].self, from: data)
    else {
        return []
    }
    return items
}
