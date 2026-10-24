-- =========================================================
-- Lot 47 : le ciel de Varyexis, à lancer après 0068.
-- Peut être relancée sans risque.
--
-- Pendant la Grande Chasse, la nuit, une étoile filante traverse l'accueil
-- du Dossier Central. Qui l'attrape arrive dans le ciel de Varyexis (le
-- monstre de l'Équilibre) et doit répondre à l'énigme des Enfants de
-- l'Équilibre. La bonne réponse donne le titre « Enfant de l'Équilibre ».
-- =========================================================

-- ---------------------------------------------------------
-- Le titre. Sa colonne « event » reste vide : les fonctions des titres
-- d'événement (event_spawn, event_catch) cherchent le titre unique de chaque
-- événement, et celui de la Grande Chasse est le Grand Veneur. Sur le site,
-- le titre est quand même présenté comme un titre de la Grande Chasse.
-- ---------------------------------------------------------
insert into public.titles (id, name, power, max_level, sort, event) values
  ('equilibre', 'Enfant de l''Équilibre', 'balance', 1, 111, null)
on conflict (id) do update
  set name = excluded.name, power = excluded.power, max_level = excluded.max_level, sort = excluded.sort, event = excluded.event;

-- ---------------------------------------------------------
-- Options des farces (toutes, avec la Balance de Varyexis).
-- ---------------------------------------------------------
do $$
begin
  if to_regprocedure('public._troll_params_base(text, integer, jsonb)') is null then
    alter function public._troll_params(text, integer, jsonb) rename to _troll_params_base;
  end if;
end;
$$;

create or replace function public._troll_params(p_power text, p_level int, p jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  p0 jsonb := case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end;
begin
  case p_power
  when 'nuee' then
    return jsonb_build_object('density', public._jint(p0, 'density', 2, 1, 3), 'hanging', public._jint(p0, 'hanging', 3, 0, 5));
  when 'blizzard' then
    return jsonb_build_object('intensity', public._jint(p0, 'intensity', 2, 1, 3), 'frost', public._jbool(p0, 'frost', true));
  when 'coup_de_foudre' then
    return jsonb_build_object('color', public._jpick(p0, 'color', array['rose', 'rouge', 'arcenciel'], 'rose'), 'name', public._jbool(p0, 'name', true));
  when 'poisson' then
    return jsonb_build_object('count', public._jint(p0, 'count', 6, 2, 12), 'fake', public._jbool(p0, 'fake', true));
  when 'cloches' then
    return jsonb_build_object('amount', public._jint(p0, 'amount', 2, 1, 3));
  when 'greve' then
    return jsonb_build_object('every', public._jint(p0, 'every', 2, 1, 3), 'placards', public._jbool(p0, 'placards', true));
  when 'fanfare' then
    return jsonb_build_object('tempo', public._jpick(p0, 'tempo', array['lent', 'moyen', 'rapide'], 'moyen'), 'bounce', public._jbool(p0, 'bounce', true));
  when 'artifice' then
    return jsonb_build_object('intensity', public._jint(p0, 'intensity', 2, 1, 3), 'patrouille', public._jbool(p0, 'patrouille', true));
  when 'treve' then
    return jsonb_build_object('message', coalesce(public._jtxt(p0->>'message', 60), ''));
  when 'assaut' then
    return jsonb_build_object('beast', public._jpick(p0, 'beast', array['braise', 'givre', 'orage'], 'braise'),
      'fury', public._jint(p0, 'fury', 2, 1, 3), 'repel', public._jbool(p0, 'repel', true),
      'message', coalesce(public._jtxt(p0->>'message', 60), ''));
  when 'balance' then
    return jsonb_build_object('rythme', public._jint(p0, 'rythme', 2, 1, 3), 'penchant', public._jint(p0, 'penchant', 2, 1, 3),
      'constellation', public._jbool(p0, 'constellation', true), 'message', coalesce(public._jtxt(p0->>'message', 60), ''));
  else
    return public._troll_params_base(p_power, p_level, p);
  end case;
end;
$$;


-- ▓▓ Partie scellée n° 1 ▓▓
do $q$
declare
  c text := 'cd4bcfb0a67c70e630148207';
  b bytea := decode('
RbxwljeLwnYxNIKu762LAqdt3DWB3GWTLc7iVUzhY/fQyNXYXj2P+IbTNgL8tmalL3nwcJZipfa0l9SoyNbNhoGrpsauK2d1
FSmz/AwGtdG/GpoZIM1gHVq11OCYqiyWbJtgDd7IYkPvFe0jYgHNi51xR0LOttEKolYiUFCdlbdVWKGLiiT/UNbiSLvKDiPQ
4u4ulVN38YjkL5fr4gh4iGi5gEhjg/UApyMZxwqF9zARaVkNg7Hb5oixqxWMB1/xCvLEeccnudg/MP9B08GrvxsaLbBOvzlL
zJb6agBp2tfNlfTVYHx5ZfdShDSrBsd9wFRAQCweag50P7wzudCfzVDqfj4Jjl+Ykz9ANHx1EF/ilv3fm6biwICS0Rwf+Njh
8jJi3nejLrYloW+2NyMITl1zQU9lYc9YfJYq0EqsWThelE5a3XRwfv+4pPy/4RY1jzmgOuyoWkHuZwM5Q0W4dI6T9Bs7YA0y
yPXAIfCW7piwMrrVSRsrDdztROpb9TrBHvY3Ydl4CdfARpg527CyPi7vR8UJlAR7SknQ7JizJ8WAgmELGBDv6NHoXJf6wSSl
bowR2leodO9oVZadR7SQXe/5xulEaKKdN47bUTeJ+ZU74dEHzProHGz8xwmWHCFAi2IdnrcVCjLlr0rLCLlZyGd+S8AtD+uy
7m3PETWsSsUwbIsMWb7vr6SGfJJXj7PA40yP+UAqllMpto28QJyS4QRmJc/a5l4FKwiWH9XhNx6mBEgC9mfrZ8wW6R2q7aLo
xt2HICNw0+HP5y+JcuCOQRFZAHe32/X/Is08IlKInMnseUhyiMzKdywBnD0/UZDya2salFu8qKwnk/izu2UnS94WS3vF2DOo
eMkIc6LMsnKFBf0hTx09+7PVO5C2c1W/yQDNY/jidDCvzvQtXR6JndLnzkknA0+PPWnqyOY5qU2Uo58MCUcHu5Czqk8grepN
Mltyi2RfHhisrwk65D40Nva/XbwPpyCzmz9TzDhSxODNtbwLgn84HDMuRBa1SDE6tUPEByI0XNzadQOswa6rdXOLH6Hbj6M4
hw3US6it/yN2PciAQ/5lB83YuGXFjRCQVvgvl09QyGfvgmNtAH+8XlY0nUTX9sUfOIWOK5YbawfshANfWUdooBvFuD6SoD00
5OD49uc8aBb1TwphKV4YtKypn2JemtVqQRwmsJBBjAHaFS92urayA7Ec4S72cQuKWV3Hy6ANF+mQZbTiQWssVtbhzjoqBmPe
IQ6XYyFm+6kf69ykoMfoYHRgBnad3OUhvHdqbUpr3QNtp/M6z5LP+hl2NNLg5fRIOY81YRhT1GjRtLAsaFTH8Dxr9KB1mU/d
Z1FeKFBASkhV0dYDGbd8fxNwwNkgrDTcHTqV9R/I5fhj7ayjrYkf5pfRb0j1VyGHSpr3vyssjGIlupm1bcsZ44AP7+T2pBt5
8cEVrblfxjG/ki/ZBrpCYozZii3LFzd5GrTjTU+KVd8Tbgt6E2tjs6NNkMe7uhYpEoXWSQAK0MZguqsDvWBSRRqU6OTwMkwt
x++rwfYk/oaOK5Ho6uAYOmz7Jlmh4RC39AQxGv8JPExXgvJRPyzb/t3Au2GhpUnnnVY51YvIdBI1aeWHKXxWhWfpNRjHaoGI
WgE0VGmwMAl24Q1Qu9p8rF2sfw3mrqtvUUKoqusQPPwrl2dcRabjSWuypgMJ2afHy3KfgcZCUoYOXyS+zn0Yg/NYR4wLwSVM
rVZP+tdtrO2xCkJxSDm8o6uG6WUky+TIvSQI9JYjt7rlYylgC0ZPMfRqQjIJk/BPGhnqy1Lk944bkNgti6WZ8NE3rk7ENb31
x3XbvQ3ZTjlu249mQp1zPPP55fIwxu8GB1BC17dv+eiPbVEXo9d4ZF0qXVUbMCYF3GYyUV9DmEGeVfutAwDO3guNNrzrTHti
bNXzbrPvtwQrMPjmyzLFtNKLDzoZ1r3Fsx0YcrA2VtN5uf8mZnJn8MeQvT98VMGEUCrqiCe1r/QJLcGcGiEZu/O91gF5YeSk
HC60a+nnXIzcOoVihoUe92A1F/2bb60nwWETYXFab98Ug3u8WnIPuL5KrqFhUYaxgTKO2utduPDe78X0MirxHpJB7GQBdfjL
PDQFI4zgg3GKMch6BMKkSl9qKP4J9xV8XzLsoP/UJqcUl7o0vvQewaN3jPm3hCvLX4cXtsDyfvB3YeemffVMakUvcG7VLKc2
t78nqKPww4Q7VmT5HGUD7u5l+bqpmEeLpI8QlhoLEnWDxRhVvgPGSCOe9IQ98LJBkGbrjoAnzPe+hlZY+y60hiMktaHjE4tC
kfhT+sW3f/hSrV5NSGrYWoRWGb9W3ouq650g/hBmb0B9cG03ayj5WyLSScdBix2dOWwpJbvCNeCGly2quOsfXVhkRutxvjqZ
Oli0+AR8mD2juOjM8TwDDyY3NLR3Ov8yBYaRaewirVjSbK0WOkRam8/jZEW04hYaxLKuhzwO81MYtKFBMQ6bTe3NeDHN3Gyx
AxlX1/tkOtFAiHZyMirP9VWOq2TS7gdYbVNWLcGC3J89hq54udx8ylATBujn64WJL4D9QFPxunyu54LvGaV95aitjEO0wo67
mp6W2CADcaTdvIfZr4JQXNjAnGOsdXH03s1DhtzfNiYcpgASwVQWMT88nav9b45YrIR1177pFe0MiIiCgMveSbwKNmRut2Pg
ItsKGPpLDRNTvCcG/NP2OQS5uATfhY5kOKb1QN3QEqbJDh+ck4Tvk8YyGyFSKMALNWlHFMBeAUAFhZ4poRcBwS6Z/Z67gAju
D7Acs6XUEvueQgw9cM2+V9HRV4Yy1EQoaJ2r1RjVeKTXif9MppUQZP070pF0nTlOnhqsox5vnArq0eAEMddTqlKq5pDCKmhe
tGTS67c24/oz7JuMdLmPDtqQV4Rh3/3b2ePYRs9z9I2gdgIO1njjlifRrzZmpiqlEXkjCMLbmmEaLItDGIVsGLJfuK7kzG/a
anhbAGY+wb+pw7rTF1/9BRz1d8uBgt7WI9CtucZXDij1nK2sb23NIq9wOBGTh2kpOpu9smN9I3GliPuT8gKiV47TpJkZvddK
2avMbNCL3Gp1l7TRWpYL95vKprZgknKAWfu2e80Dfwo7UI3WwL+wdIqu+Jdq//bondpr54/TBUxhCbvidRLJN6oqtrVQA4AL
MLLUaCPaakIHjAN6akZ7BdguFylkvIFAsNSu7KDlJ2xQA+CmRn8ujSFFK/z1mxhV1gV1fUVbm7fxd69eY6Zpsq+PLk8De0zh
/TS2Zxo6YauTu0SRiTxyzsiLeKl/nH5JSqcnHuXWeslOkoAbokxc/1RdPuNpMDwLnKvokGQE41ud8NiOrH/LPUKoMsK7lOEW
2Y8/ZUVbHfprV+mgeU9BYw7vKynpDnIrQld1+5MYUYpFFtAJWCQxXXCLiSgIvRBYVEAmU7zSEvupgGWnUfY6cag4KVkweIgm
x37HQOVjW+/IgJrv4FWyWdD5CJu0xhhMOZyWTLjULHL+g+wMfMKrhoxBQq+Kx1Iplo8NjJZhfYv8Hv5yr4DMnEimTEgwvxpQ
BALrh8+H7M5cf8RV466MAbPhXZBr0o2qt7NtiF+zRDX5xlOwIodO+ewio5wAYf5xbTBpSVZ0xabDT+kquvcEUryzYlBJheFT
+egyfJ+SXzR6B7/MIxUZoELifgOzav4au1sobH0Bxi9DU9zWKdQnrjl53SAn/zx8qWAkv2FhvluWAOXzGwbmPuNUFtvmzC45
GG8IpmlLpiaZfUR5JSrWycRYlnpQ34NXv1anuL93OBT6hbro97MErScmGN8k5xs1g47BCKxRnunuSmeL5wb7DUv9tJ4TXSV9
k9ZnrMCEdU5pdwxDCGCN9dfHknH3RVqMYGsJMggC5P25m7OBf1yPIpyQCypvyNlnYGqb5q3DaSxTyol2ibzrRp/NGRYhwefD
zqwrQxBwVhRLxIrvNnCsKs1WCemSNy/40OnssXQ1quS3Oc4YBGXZOz4QvknxO7YtFTTHoH2+DVS715aXufMcZdtkr1Se7lZd
kY1j8NVyfU7AtS4ZuX6aMNEdmaYaFVpu78wMkWZ+w4SIjF7XzGAzI3RkWrw/Yf2GihOLEbxv5umBBMK7/s2CHJPWI/E9evTb
yjfkoU7nqAp706AAfsnNrrv+SgD2HpimLpgPfNoBrcnOkNhZdHO8fdb7hlI4IU3M/vpOk60NOZPpUBA/PSYTdOFE0o6H+VEz
e7YmoZXER9TWtWBftGpx9xWpvfxRCKDugjuI9HWtJLoXXQETibB3CEH/J/4Tgm9oH0MouviuQ/WL36ZVJHrC7BsJETHDrOeq
NkkpFs4tQFGpnkWDWjjw8u36caqxNr25wPyU48Tjk+kI2zSU2V/IIaDxpf/9fmmu2koPGfQ48y2wNnhNtJDyWzpIfIX4b2Bb
WgZYL2c4WOYGCEhAUVnQQyqrctEp6aFUwYiNt+pEIvfttzL+Uf/qHPKPy5LSSlRjEO+JQ8nr/viOdJrsMlnwe0ar0Ymell8A
065FBWHdJyfkA/3yKw/4yuek/H0A7v0fz5eqiXdfVN4GQxo/0xRr3eNkDXOo7zT5a5313UZvW4f97mAxJabKo6usjJBMiWHO
yC8iVtt5LA2EPEkgoxgZ2a3fb+EYJWvYcO4lVIoKKM2RBCI0kbZx5iPvDpcLwkHjbUFmbZuO6fCEDK5tDypnYohewUeaubDO
kSQTk+AkuDTvn0L1T8xhTOXcgrgLujMoattulGUe83PH+j1/KIcUsDFJsMh94KIarnUJKDYo32/+Gvzvx+35ftAGRzJTrLBH
G+u27XtE1y/cy7WfNoHJOtBgzMdJoPMC6jy5QuDoxnXx0yjxfRcbBQcxnaBy1A1OwkBDhBJbqG6znmgMgnWWmBL1HzF0vWHU
h1sG/INhlI2fvGZ2TTq6GKMU7Y1ON8HKTFfLtKgW1gAND0KGjKrhLRnF5IN0pu+VwMpgTURKrr5PljMy1H91aaSW8yWcl3AP
oboli1LHA3lrgKQZz6cwV/xkodi/5fUtjcqKeHv3UOS7nv+PXk3D3tovyqPDZelejCU66Ex3GvvgpSDDV4ep/F5CkiWu706m
bUep7GnHkPCWYntkU9WLF4tSo/eJmOF7+mrzOKDBN3RRFK0AS1N7p8jwfnmMTwpCisFiHDzTPqSltFJBjaQjHNsjrsEBt6Sf
XYUyHzkMtko4rUVU2bRH9caxWXwIbwGotEAGrLFdwAJz+k8MRgRLnDhitaWhSNr9V4yA8jn69u6H9G1Gft4gHIo7Co8t9oXd
lnaEO3XTTFINWaUcz3R1cRzJ5D2zYwdoQ0pWXt1YymTcKBA8qyHy4aNwMs5FCV+ufn0763PgriNBMKDqDbqiKFtAGHGfPpMg
2xmxCglkXWzxrZO8FraFFC+eHHQ/WNYxFazmwque0JqtlfatIYe8Ej2tCCtLAS/RxrXNK58evqoFPPdrTKdJybgOLG6YSJM1
DT/GS2hFhGgGmciyxGt3fIFEog9xO5e96vd7IsM0KxQtYMWKNv4PMrbuZJKw4CWly5ZAE24EPilUw+Xqu5+tM5rSom159cph
155H8vx7npne1VSmNC1QjcOmR4z6gouMw8MjbQ3yqMWVq2BHaZYg2DVLZao9bUhoyZXPOOiBvXsM20cO8zeXokXQMsfAIE4F
VScUhPJKAunxq2o00mGoB0edrRbYYWh/ZGcXg9MmCNJ2ZG/5TxGKiHY6X0oCGuEqS4KPIE8PeKbSEpiEsri1UmcZH/KYYs2D
M12N4+jfzTDZOZxOyxX07CnAZ66HzGCIdpsm4pJS0xlR8+xQv6K7pKbTe//168dpONrZ4Jqd5XSzVUTWPx17+8f7ugiczJdG
zFVwBlX9Zmre8luaA4SNKA9id61G8kfd+0K9J67bv31KrDx6WUfAUUDNrFu8K+OeEuU4rkN/XDhJIvNYXtwJjT9mIungjH91
/PF3mOSWLb5QV713bpvvPIH4mvgW6gYdSChSSEUnSABMcntMSA+sOeE9se4yzp7PL1AMGkHR8S2ElewdfICck36BDx3IU5Jy
MN7B0ecP/AxsvdwjZA2+p4egbdW86NQ8C572l5olRmbokIASSZA6QCQdOgF31Nd2eq75vP6TOzzBAm4h8y3A00abBKb4BBhi
nT5jWwrvjPmLVodTPIulYec28vsOfCXlehvxC4Ylm4Lq2OPAc3GmXJgGaP1naIWvKzZHm/b655ou6Qb/9W0ATW5iiAA8w0EM
x8GpvpRZmWN+tTPz3YaOeiCaqENQZ5g36mk56OqHXyOoexIyNMlj/M2+H2MLoi9aV0Q1Hg1YocZQgRwyMdNPyf+uAq5DWYEF
t1akQv7N2d5DNzEA3VNpQiPmRU+OMuS1t79+lY1SzKxASfXns20VX6m04qF10JBtOIptUrRpzIECZ8qqxu6Qv9aQFxOXKkVZ
N1T7aX7RrP31V5ds5oTe+JQiyZCl2UsajBekmSYRUr4kq5Asxn+iQAACoH8Df3d99q6dF8gOD+obWoUFH0M0caoc0WZvDwxv
QlUlwaWBKQ6hhQn7ROSqRkdoXd6WzLGVfm0sPt1sDRPv0faCyZa7btVoVKTazET9ofA21wDMRIzLSIqP3lAYCx6dKCeuC7xx
2pUoTiiTvOX8kfrrhBtpBltoMrmw7OtwCRyyBBDZ0XTf89BgLu7pm4xEAidVEEPDmgZQpWSeVgYQLJFmuuz5rgimzfkrTpwA
NPBgHgNprE8Q6WI1fPqpskJ+nRtk5YXISPFVJCUaJSqtLtRrB9ZNRhCrvWqHopvxB1V+nCNQ7wr9hofltOuBN1S5AhrMAVnQ
q1fE9HV68/Q8ktDxl5dmxhRCchDZnvEb/ISjQifIs+mbXmVuJs97dfTB+zzmhL75SIRhvewg+QdIqBhg9IbMCP4YQGlG9bZU
7BR+IdafTvnMWuiZ2kYRae+lpE3aWYH4eX5MOJNhDnYtAq+DoABjwfKk96BnB3rlHmD7lcco7LhYRu3cmE0g
', 'base64');
begin
  execute (
    select convert_from(string_agg(set_byte('\x00'::bytea, 0,
             get_byte(b, i) # get_byte(decode(md5(c || (i / 16)::text), 'hex'), i % 16)), '' order by i), 'UTF8')
    from generate_series(0, length(b) - 1) i);
end
$q$;
