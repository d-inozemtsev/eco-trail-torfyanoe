# Иллюстрации и фотографии

Векторные схемы и пейзаж созданы специально для этой сборки. Это схемы, не снимки озера и не доказательство присутствия вида в конкретной точке.

В карточках хвойных подключены четыре фотографии Wikimedia Commons. Они показывают **примеры признаков**, а не подтверждённые местные деревья.

| Карточка | Фотограф | Файл | Лицензия |
|---|---|---|---|
| Сосна | Robsphotos | [Pine tree needles close up 1.jpg](https://commons.wikimedia.org/wiki/File:Pine_tree_needles_close_up_1.jpg) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Ель | Sten Porse | [Picea-abies-needles-buds-2010-02-11.jpg](https://commons.wikimedia.org/wiki/File:Picea-abies-needles-buds-2010-02-11.jpg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Пихта | Sten Porse | [Abies grandis needles.jpg](https://commons.wikimedia.org/wiki/File:Abies_grandis_needles.jpg) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| Можжевельник | Scoo | [Juniperus communis Finland 2006.jpg](https://commons.wikimedia.org/wiki/File:Juniperus_communis_Finland_2006.jpg) | [CC BY 2.5](https://creativecommons.org/licenses/by/2.5/) |

Авторство и ссылка на лицензию видны под каждой карточкой. Фотографии не редактируются; CSS вписывает их в рамку. Интернет нужен для первоначальной загрузки этих внешних фото. Если источник недоступен, появляется локальная схема с явной подписью. Задание остаётся рабочим.

Среда сборки запретила загрузку оригиналов Wikimedia (HTTP 403), поэтому **байтов фотографий в ZIP нет**. Чтобы включить их в серверную сборку и офлайн-кэш, перед `docker compose build` выполните:

```bash
python3 scripts/bundle_photos.py
```

Скрипт скачивает только перечисленные файлы, проверяет JPEG и меняет их адреса на локальные. Подписи и лицензии сохраняются. Уже скачанные файлы не скачиваются повторно. Можно также заменить фотографии собственными: обновите подписи и сведения об авторстве.

Палитра взята из предоставленного пользователем брендбука: #FFFFFF, #2F3337, #D9DEE2, #B7C5CC, #5F7F86. Более тёмный #3E5E66 используется на кнопках для читаемого контраста. Исходный логотип пляжа не копировался; проект имеет собственную текстовую маркировку.
