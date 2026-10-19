import AppIntents
import Foundation
import WidgetKit

// Siri ve Kısayollar: "Su Molası ile su ekle", "Su Molası'nda bugün ne kadar içtim?"
// Uygulamayı açmadan çalışır. Eklenen miktar, widget butonlarının kullandığı aynı
// App Group kaydına "pending" olarak yazılır; uygulama açılınca widgetSync.js bunu alır.

private enum WaterShared {
  static let widgetName = "WaterWidget"
  static var suite: String {
    (Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String) ?? "group.com.farukemreoz.sumolasi"
  }
  static var timelineKey: String { "__expo_widgets_\(widgetName)_timeline" }

  static func todayKey(_ date: Date = Date()) -> String {
    let f = DateFormatter()
    f.calendar = Calendar(identifier: .gregorian)
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
  }

  static func isoNow() -> String {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f.string(from: Date())
  }

  // Şu ana kadar başlamış en son girişin indeksi (JS tarafındaki currentEntryProps ile aynı kural)
  private static func currentIndex(_ timeline: [[String: Any]]) -> Int? {
    guard !timeline.isEmpty else { return nil }
    let nowMs = Date().timeIntervalSince1970 * 1000
    var idx = 0
    for (i, entry) in timeline.enumerated() {
      let ts = (entry["timestamp"] as? Double) ?? (entry["timestamp"] as? NSNumber)?.doubleValue ?? 0
      if ts <= nowMs { idx = i }
    }
    return idx
  }

  /// Bugünkü toplam ve hedef (uygulama hiç açılmadıysa nil)
  static func status() -> (total: Int, goal: Int)? {
    guard let defaults = UserDefaults(suiteName: suite),
          let timeline = defaults.array(forKey: timelineKey) as? [[String: Any]],
          let i = currentIndex(timeline),
          let props = timeline[i]["props"] as? [String: Any] else { return nil }
    let goal = (props["goalMl"] as? NSNumber)?.intValue ?? 2500
    let sameDay = (props["date"] as? String) == todayKey()
    let total = sameDay ? ((props["totalMl"] as? NSNumber)?.intValue ?? 0) : 0
    return (total, goal)
  }

  /// Su ekler; yeni (toplam, hedef) döner. Uygulama hiç açılmadıysa nil.
  static func add(_ ml: Int) -> (total: Int, goal: Int)? {
    guard let defaults = UserDefaults(suiteName: suite),
          var timeline = defaults.array(forKey: timelineKey) as? [[String: Any]],
          let i = currentIndex(timeline),
          var props = timeline[i]["props"] as? [String: Any] else { return nil }

    let today = todayKey()
    let goal = (props["goalMl"] as? NSNumber)?.intValue ?? 2500
    let sameDay = (props["date"] as? String) == today
    let total = (sameDay ? ((props["totalMl"] as? NSNumber)?.intValue ?? 0) : 0) + ml

    var pending = (props["pending"] as? [[String: Any]]) ?? []
    pending.append(["d": today, "ml": ml, "id": "s" + UUID().uuidString])

    props["date"] = today
    props["totalMl"] = total
    props["pending"] = pending
    props["lastAddAt"] = isoNow()
    timeline[i]["props"] = props
    defaults.set(timeline, forKey: timelineKey)

    WidgetCenter.shared.reloadTimelines(ofKind: widgetName)
    return (total, goal)
  }

  static func fmt(_ n: Int) -> String {
    let f = NumberFormatter()
    f.numberStyle = .decimal
    f.locale = Locale.current
    return f.string(from: NSNumber(value: n)) ?? "\(n)"
  }

  static var isTurkish: Bool {
    (Locale.preferredLanguages.first ?? "en").hasPrefix("tr")
  }
}

enum WaterAmount: Int, AppEnum {
  case glass = 200
  case mug = 300
  case bottle = 500

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Amount"
  // Derleme sırasında metadata'ya çıkarıldığı için başlıklar sabit olmalı (dil bağımsız)
  static var caseDisplayRepresentations: [WaterAmount: DisplayRepresentation] = [
    .glass: "200 ml",
    .mug: "300 ml",
    .bottle: "500 ml",
  ]
}

struct AddWaterIntent: AppIntent {
  static var title: LocalizedStringResource = "Add Water"
  static var description = IntentDescription("Adds water to today's total without opening the app.")
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Amount", default: .glass)
  var amount: WaterAmount

  static var parameterSummary: some ParameterSummary {
    Summary("Add \(\.$amount)")
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let tr = WaterShared.isTurkish
    guard let result = WaterShared.add(amount.rawValue) else {
      let msg = tr ? "Önce Su Molası'nı bir kez aç." : "Open Water Break once first."
      return .result(dialog: IntentDialog(stringLiteral: msg))
    }
    let added = WaterShared.fmt(amount.rawValue)
    let total = WaterShared.fmt(result.total)
    let goal = WaterShared.fmt(result.goal)
    let msg: String
    if result.total >= result.goal {
      msg = tr ? "\(added) ml eklendi. Bugün \(total) ml, hedef tamam!" : "Added \(added) ml. \(total) ml today, goal reached!"
    } else {
      let left = WaterShared.fmt(result.goal - result.total)
      msg = tr ? "\(added) ml eklendi. Bugün \(total) / \(goal) ml, \(left) ml kaldı." : "Added \(added) ml. \(total) / \(goal) ml today, \(left) ml to go."
    }
    return .result(dialog: IntentDialog(stringLiteral: msg))
  }
}

struct WaterStatusIntent: AppIntent {
  static var title: LocalizedStringResource = "Today's Water"
  static var description = IntentDescription("Tells how much water you drank today.")
  static var openAppWhenRun: Bool = false

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let tr = WaterShared.isTurkish
    guard let s = WaterShared.status() else {
      let msg = tr ? "Önce Su Molası'nı bir kez aç." : "Open Water Break once first."
      return .result(dialog: IntentDialog(stringLiteral: msg))
    }
    let pct = Int((Double(s.total) / Double(max(s.goal, 1)) * 100).rounded())
    let total = WaterShared.fmt(s.total)
    let goal = WaterShared.fmt(s.goal)
    let msg = tr ? "Bugün \(total) / \(goal) ml içtin, %\(pct)." : "You drank \(total) / \(goal) ml today, \(pct)%."
    return .result(dialog: IntentDialog(stringLiteral: msg))
  }
}

struct WaterShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: AddWaterIntent(),
      phrases: [
        "Add water in \(.applicationName)",
        "Log water in \(.applicationName)",
        "Add \(\.$amount) in \(.applicationName)",
        "\(.applicationName) su ekle",
        "\(.applicationName) ile su ekle",
        "\(.applicationName) ile \(\.$amount) ekle",
      ],
      shortTitle: "Add Water",
      systemImageName: "drop.fill"
    )
    AppShortcut(
      intent: WaterStatusIntent(),
      phrases: [
        "How much water did I drink in \(.applicationName)",
        "\(.applicationName) bugün ne kadar su içtim",
        "\(.applicationName) durumum",
      ],
      shortTitle: "Today's Water",
      systemImageName: "chart.bar.fill"
    )
  }
}
