import WidgetKit
import SwiftUI

// MARK: - Shared Data Model
struct ShowBoatWidgetData: Codable {
    let updatedAt: Double?
    let displayName: String?
    let avatar: String?
    let stats: Stats?
    let upNext: [UpNextItem]?
    let recentRatings: [RatingItem]?
    let streak: Int?

    struct Stats: Codable {
        let episodes: Int?
        let movies: Int?
        let shows: Int?
        let ratings: Int?
        let watchlist: Int?
        let friends: Int?
    }

    struct UpNextItem: Codable {
        let name: String?
        let poster: String?
        let type: String?
    }

    struct RatingItem: Codable {
        let name: String?
        let score: Double?
        let type: String?
    }
}

// MARK: - Data Provider
func loadWidgetData() -> ShowBoatWidgetData? {
    let defaults = UserDefaults(suiteName: "group.me.showboat.app")
    guard let raw = defaults?.string(forKey: "widget_data"),
          let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(ShowBoatWidgetData.self, from: data)
}

// MARK: - Colors
extension Color {
    static let sbBg = Color(red: 15/255, green: 23/255, blue: 42/255)
    static let sbGreen = Color(red: 52/255, green: 211/255, blue: 153/255)
    static let sbBlue = Color(red: 56/255, green: 189/255, blue: 248/255)
    static let sbYellow = Color(red: 250/255, green: 204/255, blue: 21/255)
    static let sbOrange = Color(red: 249/255, green: 115/255, blue: 22/255)
    static let sbSlate = Color(red: 148/255, green: 163/255, blue: 184/255)
    static let sbDarkSlate = Color(red: 30/255, green: 41/255, blue: 59/255)
}

// ===================================================================
// MARK: - Stats Widget
// ===================================================================

struct StatsEntry: TimelineEntry {
    let date: Date
    let data: ShowBoatWidgetData?
}

struct StatsProvider: TimelineProvider {
    func placeholder(in context: Context) -> StatsEntry {
        StatsEntry(date: Date(), data: nil)
    }
    func getSnapshot(in context: Context, completion: @escaping (StatsEntry) -> Void) {
        completion(StatsEntry(date: Date(), data: loadWidgetData()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<StatsEntry>) -> Void) {
        let entry = StatsEntry(date: Date(), data: loadWidgetData())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct StatsWidgetView: View {
    let entry: StatsEntry

    var body: some View {
        let stats = entry.data?.stats
        VStack(spacing: 6) {
            // Header
            HStack {
                Text("🚢 ShowBoat")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.sbGreen)
                Spacer()
                if let name = entry.data?.displayName {
                    Text(name)
                        .font(.system(size: 10))
                        .foregroundColor(.sbSlate)
                }
            }

            // Row 1
            HStack(spacing: 8) {
                StatCell(value: stats?.episodes ?? 0, label: "Episodes", color: .sbGreen)
                StatCell(value: stats?.movies ?? 0, label: "Movies", color: .sbBlue)
                StatCell(value: stats?.shows ?? 0, label: "Shows", color: .purple)
            }

            // Row 2
            HStack(spacing: 8) {
                StatCell(value: stats?.ratings ?? 0, label: "Ratings", color: .sbYellow)
                StatCell(value: stats?.watchlist ?? 0, label: "Watchlist", color: .sbOrange)
                StatCell(value: stats?.friends ?? 0, label: "Friends", color: .pink)
            }

            // Streak
            if let streak = entry.data?.streak, streak > 0 {
                Text("\(streak) day streak 🔥")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(.sbOrange)
            }
        }
        .padding(12)
        .background(Color.sbBg)
    }
}

struct StatCell: View {
    let value: Int
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 2) {
            Text("\(value)")
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundColor(.white)
            Text(label)
                .font(.system(size: 9))
                .foregroundColor(.sbSlate)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(color.opacity(0.12))
        .cornerRadius(8)
    }
}

struct StatsWidget: Widget {
    let kind = "StatsWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StatsProvider()) { entry in
            StatsWidgetView(entry: entry)
        }
        .configurationDisplayName("ShowBoat Stats")
        .description("Your episodes, movies, shows, ratings, and more at a glance.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

// ===================================================================
// MARK: - Up Next Widget
// ===================================================================

struct UpNextEntry: TimelineEntry {
    let date: Date
    let data: ShowBoatWidgetData?
}

struct UpNextProvider: TimelineProvider {
    func placeholder(in context: Context) -> UpNextEntry {
        UpNextEntry(date: Date(), data: nil)
    }
    func getSnapshot(in context: Context, completion: @escaping (UpNextEntry) -> Void) {
        completion(UpNextEntry(date: Date(), data: loadWidgetData()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<UpNextEntry>) -> Void) {
        let entry = UpNextEntry(date: Date(), data: loadWidgetData())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct UpNextWidgetView: View {
    let entry: UpNextEntry

    var body: some View {
        let items = entry.data?.upNext ?? []
        let count = entry.data?.stats?.watchlist ?? 0

        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("📋 Up Next")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.sbBlue)
                Spacer()
                if count > 3 {
                    Text("+\(count - 3) more")
                        .font(.system(size: 10))
                        .foregroundColor(.sbSlate)
                }
            }

            if items.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    Text("Your watchlist is empty!\nDiscover something to watch 🍿")
                        .font(.system(size: 12))
                        .foregroundColor(.sbSlate)
                        .multilineTextAlignment(.center)
                    Spacer()
                }
                Spacer()
            } else {
                ForEach(items.prefix(3).indices, id: \.self) { i in
                    HStack(spacing: 8) {
                        Text(items[i].type == "movie" ? "🎬" : "📺")
                            .font(.system(size: 11))
                        Text(items[i].name ?? "—")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.white)
                            .lineLimit(1)
                        Spacer()
                        Text(items[i].type == "movie" ? "Movie" : "TV")
                            .font(.system(size: 10))
                            .foregroundColor(.sbSlate)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color.sbDarkSlate.opacity(0.5))
                    .cornerRadius(8)
                }
            }
        }
        .padding(12)
        .background(Color.sbBg)
    }
}

struct UpNextWidget: Widget {
    let kind = "UpNextWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: UpNextProvider()) { entry in
            UpNextWidgetView(entry: entry)
        }
        .configurationDisplayName("ShowBoat Up Next")
        .description("See what's next on your watchlist.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

// ===================================================================
// MARK: - Recent Ratings Widget
// ===================================================================

struct RecentEntry: TimelineEntry {
    let date: Date
    let data: ShowBoatWidgetData?
}

struct RecentProvider: TimelineProvider {
    func placeholder(in context: Context) -> RecentEntry {
        RecentEntry(date: Date(), data: nil)
    }
    func getSnapshot(in context: Context, completion: @escaping (RecentEntry) -> Void) {
        completion(RecentEntry(date: Date(), data: loadWidgetData()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<RecentEntry>) -> Void) {
        let entry = RecentEntry(date: Date(), data: loadWidgetData())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct RecentWidgetView: View {
    let entry: RecentEntry

    var body: some View {
        let ratings = entry.data?.recentRatings ?? []

        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("⭐ Recent Ratings")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.sbYellow)
                Spacer()
                if let name = entry.data?.displayName {
                    Text(name)
                        .font(.system(size: 10))
                        .foregroundColor(.sbSlate)
                }
            }

            if ratings.isEmpty {
                Spacer()
                HStack {
                    Spacer()
                    Text("No ratings yet.\nStart rating what you watch! ⭐")
                        .font(.system(size: 12))
                        .foregroundColor(.sbSlate)
                        .multilineTextAlignment(.center)
                    Spacer()
                }
                Spacer()
            } else {
                ForEach(ratings.prefix(3).indices, id: \.self) { i in
                    HStack(spacing: 8) {
                        Text(ratings[i].name ?? "—")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.white)
                            .lineLimit(1)
                        Spacer()
                        Text(formatStars(ratings[i].score ?? 0))
                            .font(.system(size: 11))
                            .foregroundColor(.sbYellow)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color.sbDarkSlate.opacity(0.5))
                    .cornerRadius(8)
                }
            }
        }
        .padding(12)
        .background(Color.sbBg)
    }

    func formatStars(_ score: Double) -> String {
        if score <= 0 { return "—" }
        let full = Int(score)
        let half = (score - Double(full)) >= 0.5
        var stars = String(repeating: "★", count: min(full, 5))
        if half && full < 5 { stars += "½" }
        return "\(stars) \(String(format: "%.1f", score))"
    }
}

struct RecentWidget: Widget {
    let kind = "RecentWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: RecentProvider()) { entry in
            RecentWidgetView(entry: entry)
        }
        .configurationDisplayName("ShowBoat Ratings")
        .description("Your latest ratings with star scores.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

// ===================================================================
// MARK: - Widget Bundle
// ===================================================================

@main
struct ShowBoatWidgetBundle: WidgetBundle {
    var body: some Widget {
        StatsWidget()
        UpNextWidget()
        RecentWidget()
    }
}
