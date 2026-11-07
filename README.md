# دوري المنطقة — تحديث شريط الأخبار وتجربة الهاتف

## محتويات التحديث
- شريط أخبار متحرك أعلى الموقع.
- الضغط على الخبر يفتح نافذة لقراءة الخبر كاملًا، ويمكن إغلاقها بزر × أو الضغط خارجها أو Escape.
- زر إيقاف/تشغيل حركة الشريط.
- تبويب إدارة الأخبار لإضافة الأخبار وحذفها.
- على الهاتف في الوضع الرأسي تظل خانة النقاط ثابتة أثناء تمرير الجدول أفقيًا.
- في الوضع الأفقي على الشاشات القصيرة يختفي الشريط العلوي (Header) لتوفير مساحة.

## مهم قبل رفع ملفات الموقع
هذا التحديث يتطلب تحديث Google Apps Script أولًا لأنّه يضيف ورقة News وأوامر addNews وdeleteNews.

1. افتح Apps Script المرتبط بنفس Google Sheet.
2. احتفظ بنسخة احتياطية من Code.gs الحالي.
3. استبدل محتوى Code.gs بمحتوى Apps_Script_Code.txt الموجود بجانب ملفات الموقع.
4. احفظ.
5. من Deploy > Manage deployments، عدّل نشر Web App الحالي واختر New version ثم Deploy. حافظ على نفس رابط /exec المستخدم في app.js.
6. اختبر رابط API؛ يجب أن يستمر في إرجاع success والفرق، وسيُنشئ الكود ورقة News تلقائيًا بعناوين News_ID وNews_Text وCreated_At.
7. ارفع محتويات مجلد league_manager_site إلى GitHub مع استبدال الملفات الموجودة، ولا ترفع Apps_Script_Code.txt إلى جذر الموقع إذا لا ترغب بعرضه للعامة.

## الأمان
عمليات إضافة وحذف الأخبار تمر عبر تحقق ADMIN_PIN في Apps Script. لا تضع رمز الإدارة داخل ملفات الموقع ولا تشاركه.


## تصدير جدول الترتيب كصورة
أُضيف زر عام أسفل جدول الترتيب يتيح لأي زائر تنزيل صورة PNG عالية الدقة للترتيب الحالي. الصورة تُنشأ داخل المتصفح من بيانات الترتيب المحمّلة، ولا تحتاج إلى تعديل Google Sheets أو Apps Script.


## Google Apps Script cache update
- Replace the existing Apps Script code with `Apps_Script_Code.txt` (or `.gs`).
- Deploy a new version of the existing Web App deployment, keeping the same access settings and URL.
- Public league data is cached for up to 15 minutes.
- Every successful admin POST action clears the cache immediately; the next public request rebuilds it from the latest Google Sheets data.
- No Google Sheets data is deleted or changed by the cache feature.
