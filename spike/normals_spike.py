"""Feasibility spike: ERA5 daily normals -> frost-free season -> crude harvest windows.
stdlib only. Read-only GET against Open-Meteo archive API."""
import json, sys, urllib.request, statistics as st
from datetime import date

def fetch(lat, lon, y0=1995, y1=2024):
    url = ("https://archive-api.open-meteo.com/v1/archive?latitude=%s&longitude=%s"
           "&start_date=%d-01-01&end_date=%d-12-31"
           "&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum&timezone=auto"
           % (lat, lon, y0, y1))
    import os, hashlib
    cache = "cache_%s.json" % hashlib.md5(url.encode()).hexdigest()[:10]
    if os.path.exists(cache):
        raw = open(cache, "rb").read()
    else:
        raw = urllib.request.urlopen(url, timeout=60).read()
        open(cache, "wb").write(raw)
    return json.loads(raw), len(raw)

def doy_stats(d):
    days = d["daily"]["time"]; tmin = d["daily"]["temperature_2m_min"]; tmean = d["daily"]["temperature_2m_mean"]; pr = d["daily"]["precipitation_sum"]
    acc = {k: [[] for _ in range(366)] for k in ("tmin","tmean","frost","pr")}
    for i, ds in enumerate(days):
        y, m, dd = map(int, ds.split("-"))
        doy = date(y, m, dd).timetuple().tm_yday - 1
        if doy == 365: doy = 364  # fold leap day
        if tmin[i] is None or tmean[i] is None: continue
        acc["tmin"][doy].append(tmin[i]); acc["tmean"][doy].append(tmean[i])
        acc["frost"][doy].append(1.0 if tmin[i] < 0 else 0.0)
        acc["pr"][doy].append(pr[i] or 0.0)
    out = {k: [st.mean(v) if v else float("nan") for v in acc[k][:365]] for k in acc}
    return out

def smooth(xs, w=15):  # circular moving average
    n = len(xs); h = w // 2
    return [st.mean(xs[(i + j) % n] for j in range(-h, h + 1)) for i in range(n)]

def longest_true_run_circular(flags):
    n = len(flags)
    if all(flags): return (0, n - 1, n)
    if not any(flags): return None
    # rotate so we start at a False
    start = flags.index(False)
    best = (None, None, 0); cur = None
    for k in range(n + 1):
        i = (start + k) % n
        if flags[i] and k < n:
            if cur is None: cur = i
        else:
            if cur is not None:
                length = (i - cur) % n or n
                if length > best[2]: best = (cur, (i - 1) % n, length)
                cur = None
    return best

def weeks(doy_a, doy_b):
    return "wk %2d - %2d" % (doy_a // 7, doy_b // 7)

# crude crop params (to be replaced by EcoCrop + curated overrides)
CROPS = {
    # name: (Tbase, Tgrow_min, Tgrow_max, gdd_to_first_harvest, harvest_len_days_if_indeterminate, kind)
    "tomato":   (10, 13, 35, 1000, 90, "warm"),
    "cucumber": (10, 15, 35,  700, 60, "warm"),
    "spinach":  ( 2,  4, 22,  450,  0, "cool"),   # cool: any 45d window inside range -> harvest at window end
}

def model(lat, lon, label):
    d, nbytes = fetch(lat, lon)
    s = doy_stats(d)
    tm = smooth(s["tmean"]); fr = smooth(s["frost"])
    frost_free = [p < 0.10 for p in fr]   # 90% chance no frost that day
    run = longest_true_run_circular(frost_free)
    monthly = [st.mean(tm[i*30:(i+1)*30]) for i in range(12)]
    print("\n== %s (%s,%s)  payload %d KB  elev %sm" % (label, lat, lon, nbytes // 1024, d.get("elevation")))
    print("   monthly Tmean: " + " ".join("%4.0f" % x for x in monthly))
    if run is None: print("   frost-free: none"); return
    a, b, L = run
    if L == 365:
        a = min(range(365), key=lambda i: tm[i]); b = (a - 1) % 365
        print("   thermal year starts at coldest day: wk %d" % (a // 7))
    print("   frost-free season (p<0.1): %s  (%d days)%s" % (weeks(a, b), L, "  [year-round]" if L == 365 else ""))
    for name, (tb, tlo, thi, gdd_need, hlen, kind) in CROPS.items():
        n = 365
        if kind == "warm":
            # plant at first day in frost-free run where smoothed Tmean >= tlo
            plant = next((( a + k) % n for k in range(L) if tm[(a + k) % n] >= tlo), None)
            if plant is None: print("   %-9s no viable planting" % name); continue
            gdd = 0; first = None
            for k in range(L - (plant - a) % n):
                i = (plant + k) % n
                gdd += max(0.0, tm[i] - tb)
                if gdd >= gdd_need: first = i; break
            if first is None: print("   %-9s season too short (%.0f GDD of %d)" % (name, gdd, gdd_need)); continue
            # harvest until frost run ends, Tmean drops below tlo, or hlen exhausted
            last = first
            for k in range(1, hlen + 1):
                i = (first + k) % n
                if i == (b + 1) % n or tm[i] < tlo: break
                last = i
            print("   %-9s plant %s -> harvest %s" % (name, "wk %2d" % (plant // 7), weeks(first, last)))
        else:
            ok = [tlo <= t <= thi for t in tm]
            cyc = 45
            harv = [all(ok[(i - k) % n] for k in range(cyc)) and fr[i] < 0.5 for i in range(n)]
            # print contiguous harvest windows
            wins = []; cur = None
            for i in range(n + 1):
                f = harv[i % n] if i < n else False
                if f and cur is None: cur = i
                if not f and cur is not None: wins.append((cur, i - 1)); cur = None
            print("   %-9s harvest windows: %s" % (name, ", ".join(weeks(x, y) for x, y in wins) or "none"))


if __name__ == "__main__":
    for lat, lon, label in [(52.52, 13.41, "Berlin"), (-33.87, 151.21, "Sydney"), (-1.29, 36.82, "Nairobi"), (33.45, -112.07, "Phoenix")]:
        try: model(lat, lon, label)
        except Exception as e: print("!!", label, type(e).__name__, e)
