from pathlib import Path
import html,base64,re
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,PageBreak,Flowable,KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader
root=Path('/Volumes/T7/GitHub/unlimited-tests'); out=root/'outputs/guides-uk'
for name,font in [('Arial','Arial.ttf'),('ArialBold','Arial Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,'/System/Library/Fonts/Supplemental/'+font))
title='Як додати виставлений деф і об’єднати однакові'
steps=[
('Виберіть комірку','На головній відкрийте «Вежі» та натисніть потрібну позицію. Перевірте її номер у заголовку форми.'),
('Позначте однакові дефи','У полі «Варіант дефу» задайте однаковий номер К1-К25 усім коміркам з однаковим дефом. Наприклад, для 1.1.1 і 2.3.2 виберіть К3. Кожна позначка зберігається одразу, навіть у порожній комірці. «Без позначки» залишає комірку поза групою.'),
('Перевірте групу','Коли у групі кілька комірок, форма показує «Спільні ніки та коментарі для комірок». Якщо є виставлені копії, нижче з’являється «Цей деф виставлено» з їхніми номерами.'),
('Додайте ніки та коментарі','У блоці «Ніки та коментарі» натисніть «+ Додати нік». Для кожного гравця вкажіть його нік і власний коментар: склад, стратегію або таймінг. Можна додати кількох гравців; порожній рядок заповніть або видаліть кнопкою ×.'),
('Заповніть дані цієї комірки','Вкажіть пробуди й додайте «Скріншот розстановки» через «Вибрати файл». Якщо ніків кілька, поле «Нік для проходки та Telegram» визначає, чий запис використовувати для цих дій.'),
('Збережіть та перевірте','Натисніть «Зберегти». Ніки й коментарі збережуться для всієї групи, а пробуди, скріншот і статус виставлення - для відкритої комірки. Перевірте «Виставлений» саме біля неї. Для повторного виставлення знятого дефу використайте «Виставити знову».')]
note='Змінювали ніки або коментарі? Спочатку натисніть «Зберегти»: до цього зміна варіанта К заблокована. Прапорці статусів і номер К зберігаються одразу.'
example='Приклад: 1.1.1 та 2.3.2 мають К3. Додавши гравця й коментар у 1.1.1 та натиснувши «Зберегти», ви побачите їх і в 2.3.2. Це не означає, що 2.3.2 автоматично стала виставленою.'
version='Опис відповідає поточним локальним змінам проєкту на 15.09.2026. На опублікованому сайті нова форма з’явиться після розгортання цих змін і міграції бази.'
images=[('01-defense-current-participants.png','Нова форма: два ніки, окремі коментарі та «+ Додати нік».'),('01-defense-current-save.png','Вибір ніку для проходки та Telegram, пробуди, скріншот і «Зберегти».')]
md=f'# {title}\n\n**Шлях:** Головна → Вежі\n\n[Відкрити вежі](https://unlimited-tests.lovable.app/towers)\n\n'
for i,(h,b) in enumerate(steps,1):md+=f'{i}. **{h}.** {b}\n\n'
md+=f'**Важливо:** {note}\n\n## Що спільне, а що окреме\n\n| Для всіх комірок з одним К | Для кожної комірки окремо |\n|---|---|\n| Ніки та коментарі гравців | Виставлення, статуси, пробуди, скріншот |\n\n{example}\n\n## Нова форма\n\n'
for f,c in images:md+=f'![{c}]({f})\n\n{c}\n\n'
md+='На знімках - незбережені навчальні записи в локальній версії. Номер К не обраний; після редагування ніків поле тимчасово заблоковане. Робочі дані не змінювалися.\n\n'+version+'\n'
(out/'01-defense.md').write_text(md)
figs=''.join(f'<figure><img src="data:image/png;base64,{base64.b64encode((out/f).read_bytes()).decode()}" alt="{html.escape(c)}"><figcaption>{c}</figcaption></figure>' for f,c in images)
(out/'01-defense.html').write_text(f'''<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title><style>body{{font:17px/1.6 system-ui;background:#f4f5f7;color:#222a33;margin:0}}main{{max-width:1000px;margin:auto;padding:32px 24px}}h1{{line-height:1.15;font-size:38px}}li{{margin:18px 0}}li p{{margin:3px 0}}aside{{background:#ffefd7;padding:18px;border-left:4px solid #e69230}}figure{{margin:24px 0}}img{{width:100%;border-radius:10px}}figcaption,footer{{font-size:13px;color:#576573}}a{{color:#9b570d}}</style><main><p>NoNameClan • Оновлений гайд 01</p><h1>{title}</h1><p>Головна → <a href="https://unlimited-tests.lovable.app/towers">Вежі</a></p><ol>{''.join(f'<li><b>{h}</b><p>{b}</p></li>' for h,b in steps)}</ol><aside>{note}</aside><h2>Що спільне, а що окреме</h2><p><b>Спільні:</b> ніки та коментарі гравців.</p><p><b>Окремі:</b> виставлення, статуси, пробуди й скріншот кожної комірки.</p><p>{example}</p><h2>Нова форма</h2>{figs}<p>На знімках - незбережені навчальні записи в локальній версії. Номер К не обраний; після редагування ніків поле тимчасово заблоковане. Робочі дані не змінювалися.</p><footer>{version}</footer></main></html>''')
styles={n:ParagraphStyle(n,fontName='ArialBold' if n in ['title','h'] else 'Arial',fontSize=s,leading=l,spaceAfter=a,textColor=HexColor('#24303e')) for n,s,l,a in [('title',22,26,10),('h',10.7,14,3),('body',10,13.5,7),('small',8,11,5),('note',9,12.2,8)]}
styles['note'].backColor=HexColor('#fff0d9');styles['note'].borderPadding=7
P=lambda t,s='body':Paragraph(html.escape(t),styles[s])
class CroppedScreen(Flowable):
 def __init__(self,path,width=249):Flowable.__init__(self);self.path=str(path);self.width=width;self.height=width*662/448
 def draw(self):
  c=self.canv;s=self.width/448;c.saveState();path=c.beginPath();path.rect(0,0,self.width,self.height);c.clipPath(path,stroke=0);c.drawImage(self.path,-416*s,-29*s,width=1280*s,height=720*s);c.restoreState()
def footer(c,d):
 c.setFont('Arial',8);c.setFillColor(HexColor('#627080'));c.drawString(38,22,'NoNameClan | Оновлено 15.09.2026');c.drawRightString(557,22,str(d.page))
story=[P('ГАЙД 01 / ОДНАКОВІ ДЕФИ','small'),P(title,'title'),P('Головна → Вежі','small')]
for i,(h,b) in enumerate(steps,1):story.append(KeepTogether([P(f'{i}. {h}','h'),P(b)]))
story += [Spacer(1,4),P(note,'note'),P('Спільні: ніки й коментарі. Окремі: статуси, виставлення, пробуди та скріншот.','h'),P(example,'small'),PageBreak(),P('Як виглядає нова форма','title'),P('Навчальний приклад із двома гравцями. Форма відкрита в локальній версії; дані не зберігалися.','body')]
cols=[]
for f,c in images:cols.append([CroppedScreen(out/f),Spacer(1,7),P(c,'small')])
t=Table([cols],colWidths=[259.5,259.5]);t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),10)]));story += [t,Spacer(1,16),P('Чому на прикладі поле К неактивне?','h'),P('У формі вже змінено ніки й коментарі, тому вибір варіанта заблокований до збереження. У робочому сценарії зручно спочатку призначити К усім копіям, а потім редагувати спільний список.'),P('Як перевірити зв’язок між копіями?','h'),P('Після призначення однакового К відкрийте комірку та перевірте рядок «Спільні ніки та коментарі для комірок». Рядок «Цей деф виставлено» показує лише виставлені й не зняті копії.'),Spacer(1,8),P(version,'note')]
file=root/'output/pdf/01-defense.pdf';SimpleDocTemplate(str(file),pagesize=(595.28,841.89),leftMargin=38,rightMargin=38,topMargin=32,bottomMargin=44,title=title,author='NoNameClan').build(story,onFirstPage=footer,onLaterPages=footer)
r=PdfReader(file);assert len(r.pages)==2
text=''.join(p.extract_text() for p in r.pages)
for word in ['Спільні','коментарі','К1-К25','Telegram','локальним']:assert word in text,word
print('Updated HTML, Markdown and PDF; PDF verified:',len(r.pages),'pages')
