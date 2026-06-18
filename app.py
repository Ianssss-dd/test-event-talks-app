from flask import Flask, jsonify, render_template, request
import feedparser
import requests
import time

app = Flask(__name__)

# Cache configuration
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
feed_cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION = 300  # 5 minutes cache

def fetch_feed(force=False):
    current_time = time.time()
    
    # Return cache if still valid and force is False
    if not force and feed_cache["data"] and (current_time - feed_cache["last_fetched"] < CACHE_DURATION):
        return feed_cache["data"], False

    try:
        # Fetch RSS feed
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
        }
        response = requests.get(FEED_URL, headers=headers, timeout=12)
        response.raise_for_status()
        
        # Parse XML
        feed = feedparser.parse(response.text)
        
        entries = []
        for entry in feed.entries:
            entries.append({
                'id': entry.get('id', ''),
                'title': entry.get('title', ''),
                'link': entry.get('link', ''),
                'updated': entry.get('updated', ''),
                'summary': entry.get('summary', '')
            })
            
        data = {
            'title': feed.feed.get('title', 'BigQuery Release Notes'),
            'link': feed.feed.get('link', 'https://cloud.google.com/bigquery/docs/release-notes'),
            'description': feed.feed.get('subtitle', 'Latest updates and features for Google Cloud BigQuery'),
            'entries': entries,
            'fetched_at': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(current_time))
        }
        
        feed_cache["data"] = data
        feed_cache["last_fetched"] = current_time
        return data, True
        
    except Exception as e:
        # If fetch fails but we have cached data, return it with a warning
        if feed_cache["data"]:
            warn_data = feed_cache["data"].copy()
            warn_data["warning"] = f"Unable to refresh: {str(e)}. Showing last cached data."
            return warn_data, False
        raise Exception(f"Failed to fetch release notes: {str(e)}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    try:
        data, is_new = fetch_feed(force=force_refresh)
        return jsonify({
            'success': True,
            'is_new': is_new,
            'data': data
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Running locally
    app.run(debug=True, host='127.0.0.1', port=5000)
