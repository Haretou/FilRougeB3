# SafeLock - Oral Intermediaire (10 min)
## 3 avril 2026 - UF CYBER B3

---

## INTRO (~1 min)

Bonjour, nous c'est Gaspard, Antoine et Raphael.

Notre projet fil rouge c'est **SafeLock** — un coffre-fort numerique personnel. En gros, c'est un espace de stockage cloud securise ou vous pouvez deposer vos fichiers sensibles : carte d'identite, contrats, releves bancaires... et y acceder depuis n'importe quelle machine.

Un peu comme un Google Drive, sauf que personne a part vous ne peut lire vos fichiers. Ni nous, ni un admin, ni quelqu'un qui piraterait le serveur. C'est ce qu'on appelle le **zero-knowledge** : tout est chiffre dans votre navigateur avant d'etre envoye. Le serveur ne voit que du bruit.

---

## LE CONCEPT (~2 min)

Concretement, comment ca marche.

Quand vous creez un compte sur SafeLock, vous choisissez un **mot de passe maitre**. A partir de ce mot de passe, on derive une cle de chiffrement avec **Argon2id** — c'est un algorithme concu pour etre lent et couteux, ce qui rend le brute-force quasi impossible.

Ensuite, chaque fichier que vous uploadez est chiffre avec **AES-256-GCM** directement dans le navigateur. Ce qui part sur le serveur, c'est un blob chiffre. Meme les noms de fichiers et les metadonnees sont chiffres.

La consequence majeure c'est que si vous perdez votre mot de passe maitre, c'est fini — personne ne peut recuperer vos donnees. C'est le prix a payer pour une vraie confidentialite. On prevoit quand meme une cle de recuperation generee a l'inscription que l'utilisateur garde de son cote.

Pour le partage entre utilisateurs, on utilise du chiffrement asymetrique : chaque utilisateur a une paire de cles RSA, et quand on partage un fichier, on rechiffre la cle du fichier avec la cle publique du destinataire.

---

## CE QU'ON A CONSTRUIT (~2 min)

On est pas partis de rien, on a deja une base solide.

**Cote front**, l'application est fonctionnelle. On a une page de connexion et d'inscription avec le branding SafeLock, un systeme d'onglets pour basculer entre les deux. Et un dashboard complet avec une sidebar, une vue "Mes fichiers" avec les dossiers, les documents, l'indication que tout est chiffre, un indicateur de stockage, la recherche, les favoris.

*(montrer la demo a ce moment la)*

**Cote infra**, on a mis en place Docker. Le `docker-compose.yml` orchestre trois services :
- L'app Next.js dans un conteneur avec un build multi-stage
- Une base **MySQL 8** pour les metadonnees et les comptes utilisateurs
- **MinIO**, un stockage S3-compatible auto-heberge, pour les blobs chiffres

Les trois services sont sur un reseau Docker isole.

**Cote base de donnees**, le schema MySQL est ecrit. On a les tables `users`, `files`, `shared_files`, `sessions` et `audit_log`. Toutes les colonnes sensibles sont de type BLOB car elles contiennent des donnees chiffrees cote client.

**Cote documentation**, la PSSI v1.0 est redigee — politique cryptographique, controle d'acces, conformite RGPD, classification des incidents. Tout est versionne dans Git.

---

## L'EQUIPE ET QUI FAIT QUOI (~1 min 30)

On est trois, chacun avec un role principal :

**Antoine** gere la partie technique lourde — les bases de donnees MySQL et NoSQL, le DevOps avec Docker et le pipeline CI/CD, et c'est lui qui fera le pentesting de la solution. Il co-developpe aussi le backend avec moi.

**Raphael** s'occupe de toute la gouvernance et la securite documentaire — c'est lui qui a redige la PSSI, il travaille sur l'analyse de risques et le PCA/PRA. C'est aussi lui qui gere la partie gestion des incidents.

**Moi (Gaspard)**, je fais le dev frontend et backend, la partie forensique, et la coordination du projet.

Pour s'organiser on utilise **Trello** pour les taches, **Git/GitHub** pour le code et la doc, et **Teams** pour communiquer.

---

## LA SUITE — CE QUI RESTE A FAIRE (~2 min)

On a les fondations, maintenant il faut construire le reste.

**Court terme** — d'ici les prochaines semaines :
- Brancher le vrai backend : l'API d'authentification avec le hash Argon2id, les endpoints pour upload/download
- Implementer le chiffrement cote client avec la Web Crypto API
- Connecter le frontend au backend et a MySQL
- Faire tourner l'ensemble dans Docker de bout en bout

**Moyen terme** — avant le rendu ecrit en juin :
- Mettre en place le pipeline CI/CD sur GitHub Actions avec du SAST et du scan de dependances
- Integrer une base NoSQL pour centraliser les logs et les evenements de securite
- Finaliser la documentation GRC : analyse de risques complete, PCA/PRA
- Ecrire le rapport technique

**Pour la soutenance finale en juillet** :
- Pentesting complet de la solution — on va tester notre propre app : injections, OWASP Top 10, tests sur la gestion des cles, verifier que le zero-knowledge tient
- Simulation forensique — on va simuler une compromission d'un conteneur et mener l'investigation : collecte de logs, timeline, preservation des preuves
- Hardening de l'infra Docker — segmentation reseau, privileges minimaux, images minimales

---

## CONCLUSION (~30 sec)

En resume, SafeLock c'est un vrai produit avec un vrai defi technique — le zero-knowledge ca change tout dans la facon de concevoir une application. On a deja le front, l'infra Docker, la base de donnees, et la PSSI. La suite c'est du dev backend, du chiffrement, et tout l'aspect securite offensive et forensique.

Merci, on est dispo pour vos questions.

---

## ANTI-SECHE — QUESTIONS PROBABLES

**Q: Pourquoi zero-knowledge et pas un chiffrement serveur classique ?**
Avec un chiffrement cote serveur, le serveur a les cles, donc un admin ou un attaquant accede a tout. Avec le zero-knowledge, la cle n'existe que dans le navigateur. Meme si on nous pirate le serveur, les donnees sont inutilisables.

**Q: Et si l'utilisateur perd son mot de passe ?**
Les donnees sont perdues, c'est le principe. On mitigue avec une cle de recuperation donnee a l'inscription que l'utilisateur doit garder hors-ligne.

**Q: Pourquoi MySQL et pas PostgreSQL ?**
Pour notre cas d'usage c'est equivalent. MySQL est dans les competences visees du cursus et on le maitrise bien.

**Q: Comment marche le partage en zero-knowledge ?**
Chiffrement asymetrique RSA. On rechiffre la cle du fichier avec la cle publique du destinataire. Le serveur ne voit jamais la cle en clair.

**Q: C'est quoi la difference avec Bitwarden ?**
Bitwarden c'est un gestionnaire de mots de passe. Nous c'est un coffre-fort pour fichiers — documents, photos, videos. L'approche crypto est similaire (zero-knowledge) mais le produit est different.

**Q: Vous avez pentest quoi pour l'instant ?**
Pas encore — le pentesting viendra quand le backend sera branche. On va tester l'OWASP Top 10, la gestion des cles, et surtout verifier que le serveur ne peut vraiment pas acceder aux donnees en clair.
