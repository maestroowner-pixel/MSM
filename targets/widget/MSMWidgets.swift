// Marine Safety Manager — home-screen widgets (WidgetKit / SwiftUI).
//
//   • ScanWidget    (small)  — one tap into the in-app scanner (msm://scan).
//   • FlaggedWidget (medium) — the scanner button on the LEFT, and the three
//                              most-recently-touched flagged items as rows on the
//                              RIGHT. Each row deep-links to its item; when there
//                              are more than three flagged, the timeline rotates
//                              the window over time so the whole list gets a turn.
//
// Data comes only from the App Group snapshot (see Shared.swift) — the app keeps
// it fresh via services/widgetBridge.ts, which reloads these timelines on change.

import WidgetKit
import SwiftUI

// MARK: - Brand palette (theme.ts, pinned — the widget runs outside React)

extension Color {
    static let msmPrimary = Color(red: 46 / 255, green: 125 / 255, blue: 153 / 255)   // #2E7D99
    static let msmWarning = Color(red: 243 / 255, green: 156 / 255, blue: 18 / 255)    // #F39C12
    static let msmText = Color(red: 44 / 255, green: 62 / 255, blue: 80 / 255)         // #2C3E50
    static let msmTextLight = Color(red: 127 / 255, green: 140 / 255, blue: 141 / 255) // #7F8C8D
    static let msmCard = Color.white
}

private let scanURL = URL(string: "msm://scan")!

private func itemURL(_ id: String) -> URL {
    URL(string: "msm://item/\(id)") ?? scanURL
}

// MARK: - Scan widget (small)

struct ScanEntry: TimelineEntry {
    let date: Date
}

struct ScanProvider: TimelineProvider {
    func placeholder(in context: Context) -> ScanEntry { ScanEntry(date: Date()) }

    func getSnapshot(in context: Context, completion: @escaping (ScanEntry) -> Void) {
        completion(ScanEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ScanEntry>) -> Void) {
        // Static — the button never changes; nothing to schedule.
        completion(Timeline(entries: [ScanEntry(date: Date())], policy: .never))
    }
}

struct ScanButtonLabel: View {
    var iconSize: CGFloat
    var textSize: CGFloat

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: "qrcode.viewfinder")
                .font(.system(size: iconSize, weight: .semibold))
                .foregroundColor(.white)
            Text("Scan")
                .font(.system(size: textSize, weight: .bold))
                .foregroundColor(.white)
        }
    }
}

struct ScanWidgetView: View {
    var body: some View {
        ScanButtonLabel(iconSize: 40, textSize: 15)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .containerBackground(for: .widget) { Color.msmPrimary }
            .widgetURL(scanURL)
    }
}

struct ScanWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MSMScanWidget", provider: ScanProvider()) { _ in
            ScanWidgetView()
        }
        .configurationDisplayName("Scan")
        .description("Open the scanner.")
        .supportedFamilies([.systemSmall])
    }
}

// MARK: - Scan + Flagged widget (medium)

private let flaggedWindow = 3
private let rotateEveryMinutes = 20

struct FlaggedEntry: TimelineEntry {
    let date: Date
    let items: [FlaggedItem]
}

struct FlaggedProvider: TimelineProvider {
    func placeholder(in context: Context) -> FlaggedEntry {
        FlaggedEntry(date: Date(), items: [])
    }

    func getSnapshot(in context: Context, completion: @escaping (FlaggedEntry) -> Void) {
        let all = loadFlagged()
        completion(FlaggedEntry(date: Date(), items: Array(all.prefix(flaggedWindow))))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FlaggedEntry>) -> Void) {
        let all = loadFlagged()
        let now = Date()

        // Three or fewer: one static entry — there is nothing to rotate.
        guard all.count > flaggedWindow else {
            completion(Timeline(entries: [FlaggedEntry(date: now, items: all)], policy: .atEnd))
            return
        }

        // More than three: slide a window of `flaggedWindow` across the list, one
        // step every `rotateEveryMinutes`, wrapping — the vertical "carousel".
        let steps = Int(ceil(Double(all.count) / Double(flaggedWindow)))
        var entries: [FlaggedEntry] = []
        for step in 0..<steps {
            let start = (step * flaggedWindow) % all.count
            var slice: [FlaggedItem] = []
            for offset in 0..<flaggedWindow {
                slice.append(all[(start + offset) % all.count])
            }
            let date = Calendar.current.date(
                byAdding: .minute, value: rotateEveryMinutes * step, to: now
            ) ?? now
            entries.append(FlaggedEntry(date: date, items: slice))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

struct FlaggedRow: View {
    var item: FlaggedItem

    var body: some View {
        Link(destination: itemURL(item.id)) {
            HStack(spacing: 6) {
                Image(systemName: "flag.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.msmWarning)
                VStack(alignment: .leading, spacing: 1) {
                    Text(item.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundColor(.msmText)
                        .lineLimit(1)
                    Text(item.sub)
                        .font(.system(size: 11))
                        .foregroundColor(.msmTextLight)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
        }
    }
}

struct FlaggedWidgetView: View {
    var entry: FlaggedEntry

    var body: some View {
        HStack(spacing: 12) {
            Link(destination: scanURL) {
                ScanButtonLabel(iconSize: 30, textSize: 13)
                    .frame(width: 84)
                    .frame(maxHeight: .infinity)
                    .background(Color.msmPrimary)
                    .cornerRadius(18)
            }

            VStack(alignment: .leading, spacing: 6) {
                if entry.items.isEmpty {
                    Text("Nothing flagged")
                        .font(.system(size: 13))
                        .foregroundColor(.msmTextLight)
                } else {
                    ForEach(entry.items) { FlaggedRow(item: $0) }
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .padding(12)
        .containerBackground(for: .widget) { Color.msmCard }
    }
}

struct FlaggedWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "MSMFlaggedWidget", provider: FlaggedProvider()) { entry in
            FlaggedWidgetView(entry: entry)
        }
        .configurationDisplayName("Scan + Flagged")
        .description("The scanner and your latest flagged items.")
        .supportedFamilies([.systemMedium])
    }
}

// MARK: - Bundle

@main
struct MSMWidgetsBundle: WidgetBundle {
    var body: some Widget {
        ScanWidget()
        FlaggedWidget()
    }
}
