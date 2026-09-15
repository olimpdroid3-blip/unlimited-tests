from pathlib import Path
import html,base64
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,Flowable,Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
root=Path('/Volumes/T7/GitHub/unlimited-tests');out=root/'outputs/guides-uk'
for n,f in [('Arial','Arial.ttf'),('ArialBold','Arial Bold.ttf')]:pdfmetrics.registerFont(TTFont(n,'/System/Library/Fonts/Supplemental/'+f))
styles={n:ParagraphStyle(n,fontName='ArialBold' if n in ['title','h'] else 'Arial',fontSize=s,leading=l,spaceAfter=a,textColor=HexColor('#26323e')) for n,s,l,a in [('title',23,27,12),('h',12,16,6),('body',10.5,14.5,10),('small',8.5,12,8),('note',10,14,12)]}
styles['note'].backColor=HexColor('#fff0db');styles['note'].borderPadding=9
P=lambda t,s='body':Paragraph(html.escape(t),styles[s])
class Screen(Flowable):
 def __init__(self,f):Flowable.__init__(self);self.f=str(out/f);self.width=249;self.height=249*662/448
 def draw(self):
  c=self.canv;s=self.width/448;c.saveState();p=c.beginPath();p.rect(0,0,self.width,self.height);c.clipPath(p,stroke=0);c.drawImage(self.f,-416*s,-29*s,width=1280*s,height=720*s);c.restoreState()
def wide(f):
 w,h=ImageReader(str(out/f)).getSize();return Image(str(out/f),width=519,height=519*h/w)
def footer(c,d):
 c.setFont('Arial',8);c.setFillColor(HexColor('#657080'));c.drawString(38,22,'NoNameClan | Навчальні приклади | 15.09.2026');c.drawRightString(557,22,str(d.page))
pages=[
('Виставлений деф: покроково',[
('body','Покажемо весь процес на двох комірках: 1.1.1 і 2.3.2. Вони отримають однаковий номер К3 та спільний список гравців. Виставимо лише 2.3.2.'),
('h','1. Відкрийте потрібну комірку'),('body','На головній натисніть «Вежі». Виберіть позицію, яка відповідає дефу у грі. Номер відкритої комірки завжди видно в заголовку форми.')],
[('def-example-01-grid.png','Приклад 1. Сітка веж до заповнення: обираємо 1.1.1.',False)],
[('h','Що буде спільним?'),('body','Ніки та коментарі для всіх комірок з одним номером К.'),('h','Що зберігається окремо?'),('body','Виставлення, прапорці статусів, пробуди та скріншот кожної комірки.'),('note','Знімки зроблено в ізольованій навчальній копії поточної локальної версії. Ніки й дані прикладів демонстраційні. На опублікованому сайті інтерфейс може відрізнятися до розгортання змін і міграції.')]),
('Однакові дефи → однаковий К',[
('h','2. Призначте К3 першій і другій копії'),('body','У 1.1.1 виберіть «Варіант дефу» → К3. Закрийте форму, відкрийте 2.3.2 і теж виберіть К3. Номер обирайте за фактично однаковим дефом; доступні К1-К25.')],
[('def-example-02-k3.png','Приклад 2. У комірці 1.1.1 обрано К3.',True),('def-example-03-group.png','Приклад 3. У 2.3.2 теж К3: форма показує обидві спільні комірки.',True)],
[('h','3. Перевірте, що комірки об’єдналися'),('body','Знайдіть рядок «Спільні ніки та коментарі для комірок: 1.1.1, 2.3.2». Саме він підтверджує склад групи.'),('note','Номер К зберігається одразу, навіть для порожньої комірки. Він не виставляє деф автоматично. «Без позначки» залишає комірку поза групою.')]),
('Два гравці, два коментарі',[
('h','4. Додайте учасників у комірці 2.3.2'),('body','Натисніть «+ Додати нік». Виберіть гравця зі списку або введіть нік вручну. У полі нижче запишіть його склад, стратегію чи таймінг. Повторіть для другого гравця.')],
[('def-example-04-nickname.png','Приклад 4. Вибір ніку зі списку. Також можна вводити нік вручну.',True),('def-example-05-comments.png','Приклад 5. Два ніки з окремими коментарями в одній групі К3.',True)],
[('h','Не перезаписуйте чужий коментар своїм'),('body','Додайте окремий рядок для свого ніку. Кнопка × видаляє рядок зі списку; після «Зберегти» ця зміна стосується всієї групи.'),('note','Порожній рядок заповніть або видаліть. Після редагування ніків чи коментарів поле К заблоковане до натискання «Зберегти».')]),
('Збереження та перевірка копії',[
('h','5. Заповніть дані 2.3.2 і натисніть «Зберегти»'),('body','Вкажіть пробуди. Через «Вибрати файл» додайте свій скріншот розстановки. Якщо ніків кілька, оберіть «Нік для проходки та Telegram». У прикладі пробуди - 5/5; файл не додавався.')],
[('def-example-06-save.png','Приклад 6. Пробуди, вибір файлу та кнопка «Зберегти».',True),('def-example-08-copy.png','Приклад 7. Відкрили 1.1.1: видно спільну групу та «Цей деф виставлено: 2.3.2».',True)],
[('h','6. Відкрийте іншу комірку цієї групи'),('body','Після збереження 2.3.2 відкрийте 1.1.1. Спільні ніки й коментарі вже доступні там. Її власні пробуди та скріншот не копіюються з 2.3.2.'),('note','Прапорці «Пробитий», «Тестується», «Знищений», «Знятий» зберігаються одразу для відкритої комірки. Для повторного виставлення знятого дефу використайте «Виставити знову».')]),
('Як виглядає готовий результат',[
('h','7. Перевірте позначку «Виставлений»'),('body','Після збереження комірка 2.3.2 показує К3, позначку «Виставлений», обидва ніки з коментарями та список пов’язаних комірок.')],
[('def-example-07-result.png','Приклад 8. Збережена 2.3.2: видно К3, учасників і «Виставлено: 2.3.2».',False)],
[('h','Чому 1.1.1 ще не виставлена?'),('body','Однаковий К об’єднує інформацію про гравців, але не змінює місце фактичного виставлення. Для цієї навчальної групи виставлена лише 2.3.2.'),('h','Як виставити й другу копію?'),('body','Коли деф справді виставлено у 1.1.1, відкрийте її, заповніть власні дані розстановки та натисніть «Зберегти». Після успіху перевірте її позначку та оновлений список виставлених копій.'),('note','Коротко: вибрати комірку → задати спільний К → додати ніки й коментарі → заповнити дані комірки → зберегти → перевірити, де деф виставлено.')])]
story=[];md='# Як додати виставлений деф і об’єднати однакові\n\n';htmlparts=[]
for index,(title,before,images,after) in enumerate(pages):
 if index:story.append(PageBreak())
 story += [P(f'ГАЙД 01 / {index+1} ІЗ {len(pages)}','small'),P(title,'title')]
 md+=f'## {title}\n\n';htmlparts.append('<section><h2>'+title+'</h2>')
 for kind,text in before:story.append(P(text,kind));md+=text+'\n\n';htmlparts.append(f'<p>{html.escape(text)}</p>')
 if len(images)==2:
  cols=[[Screen(f),Spacer(1,7),P(c,'small')] for f,c,_ in images];t=Table([cols],colWidths=[259.5,259.5]);t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),10)]));story.append(t)
 else:
  f,c,_=images[0];story += [wide(f),Spacer(1,7),P(c,'small')]
 story.append(Spacer(1,14))
 for f,c,crop in images:
  md+=f'![{c}]({f})\n\n{c}\n\n'
  uri=base64.b64encode((out/f).read_bytes()).decode();htmlparts.append(f'<figure><img src="data:image/png;base64,{uri}" alt="{html.escape(c)}"><figcaption>{c}</figcaption></figure>')
 for kind,text in after:story.append(P(text,kind));md+=text+'\n\n';htmlparts.append(f'<p class="{kind}">{html.escape(text)}</p>')
 htmlparts.append('</section>')
file=root/'output/pdf/01-defense.pdf';SimpleDocTemplate(str(file),pagesize=(595.28,841.89),leftMargin=38,rightMargin=38,topMargin=30,bottomMargin=44,title='Виставлений деф: 8 покрокових прикладів',author='NoNameClan').build(story,onFirstPage=footer,onLaterPages=footer)
(out/'01-defense.md').write_text(md)
(out/'01-defense.html').write_text('''<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Виставлений деф: 8 прикладів</title><style>body{font:17px/1.6 system-ui;margin:0;background:#f3f5f7;color:#26323e}main{max-width:1000px;padding:30px 24px;margin:auto}section{margin-bottom:50px}h1,h2{line-height:1.2}.h{font-weight:bold}.note{padding:18px;background:#fff0db}figure{margin:25px 0}img{width:100%;border-radius:10px}figcaption{font-size:14px;color:#657080}</style><main><h1>Як додати виставлений деф і об’єднати однакові</h1><p>NoNameClan • 8 навчальних прикладів • 15.09.2026</p>'''+''.join(htmlparts)+'</main></html>')
r=PdfReader(file);assert len(r.pages)==5,len(r.pages)
text=''.join(p.extract_text() for p in r.pages)
for i in range(1,9):assert f'Приклад {i}.' in text
assert len(list(out.glob('def-example-*.png')))==8
print('Verified: 5 PDF pages, 8 illustrated examples; HTML and Markdown updated.')
