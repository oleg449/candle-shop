import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from pathlib import Path

# Абсолютный путь к твоему HTML-файлу
html_file = Path("C:/Users/supeg/Desktop/Свечи сайт/preview/site/preview.html")
html_url = html_file.as_uri()  # Конвертируем в file://

# Настройки Chrome
options = Options()
options.headless = True  # Без окна
options.add_argument("--window-size=800,1000")  # Размер окна
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")

# Запуск Chrome
driver = webdriver.Chrome(options=options)

try:
    driver.get(html_url)
    time.sleep(2)  # Дать время на загрузку стилей и картинок

    # Сохраняем скриншот
    output_path = Path("C:/Users/supeg/Desktop/Свечи сайт/preview/site/preview.png")
    driver.save_screenshot(str(output_path))
    print(f"✅ Скриншот сохранён в {output_path}")

finally:
    driver.quit()
