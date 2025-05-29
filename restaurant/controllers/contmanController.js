const mysql = require("mysql");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// Настройка подключения к базе данных
const conn = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Sasha228",
  database: "BRC",
});

// Папка для хранения изображений (public/images)
const imagesDir = path.join(__dirname, "..", "public", "images");

// Проверка, существует ли папка, если нет — создание
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true }); // Создаем папку, если не существует
}

// Настройка multer для загрузки изображений
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, imagesDir); // Папка для хранения изображений
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Генерация уникального имени для файла
  },
});

const upload = multer({ storage: storage });

class ContmanController {
  async getHideCategories(req, res) {
    try {
      const query = `SELECT ID, Наименование, Статус_удаления FROM Категория_блюда ORDER BY ID`;

      conn.query(query, (err, results) => {
        if (err) {
          console.error("Ошибка при получении категорий блюд:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при получении категорий",
          });
        }

        res.status(200).json({ success: true, categories: results });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  async getHideMenu(req, res) {
    try {
      const query = `
        SELECT 
            Блюда.ID,
            Блюда.Название,
            Блюда.Фото,
            Категория_блюда.Наименование AS Категория,
            Прайс_лист.Цена AS Цена_без_скидки,
            COALESCE(Прайс_лист.Цена - Спец_предложения.Размер_скидки, Прайс_лист.Цена) AS Цена_со_скидкой,
            Спец_предложения.Размер_скидки AS Скидка
        FROM 
            Блюда
        JOIN 
            Категория_блюда ON Блюда.ID_категории = Категория_блюда.ID
        JOIN 
            Прайс_лист ON Прайс_лист.ID = (
                SELECT MAX(Прайс_лист.ID)
                FROM Прайс_лист 
                WHERE Прайс_лист.ID_блюда = Блюда.ID
            )
        LEFT JOIN 
            Спец_предложения ON Блюда.ID = Спец_предложения.ID_блюда
            AND Спец_предложения.Дата_окончания >= CURRENT_DATE
            AND Спец_предложения.Статус_удаления = 0
        WHERE 
            Блюда.Статус_удаления = 1
        ORDER BY 
            Категория_блюда.ID, Блюда.ID;
      `;

      conn.query(query, (err, results) => {
        if (err) {
          console.error("Ошибка при получении меню с учетом скидок:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при получении меню с учетом скидок",
          });
        }

        res.status(200).json({ success: true, menu: results });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  // Обновление блюда
  updateDish = [
    // Загружаем одно изображение, поле "image"
    upload.single("image"),
    async (req, res) => {
      try {
        const { dishId, price } = req.body; // Получаем dishId и price из formData
        const image = req.file; // Получаем изображение из formData

        if (!dishId || (!price && !image)) {
          return res
            .status(400)
            .json({ success: false, message: "Данные не указаны" });
        }

        let updatedFields = [];
        let errors = [];

        // Обновление цены
        if (price) {
          const queryPrice = `
    INSERT INTO 
        Прайс_лист (ID_блюда, Цена, Дата)
    VALUES 
        (?, ?, CURDATE());
`;
          await new Promise((resolve, reject) => {
            conn.query(queryPrice, [dishId, price], (err, result) => {
              if (err) {
                errors.push("Ошибка при обновлении цены");
                return reject(err);
              }
              if (result.affectedRows === 0) {
                errors.push("Блюдо не найдено в Прайс_листе");
                return resolve();
              }
              updatedFields.push("цена");
              resolve();
            });
          });
        }

        // Обновление фото
        if (image) {
          const photoPath = `/images/${image.filename}`; // Путь к загруженному изображению
          const queryPhoto = `
            UPDATE Блюда
            SET Фото = ?
            WHERE ID = ?
          `;
          await new Promise((resolve, reject) => {
            conn.query(queryPhoto, [photoPath, dishId], (err, result) => {
              if (err) {
                errors.push("Ошибка при обновлении фото блюда");
                return reject(err);
              }
              if (result.affectedRows === 0) {
                errors.push("Блюдо с указанным ID не найдено");
                return resolve();
              }
              updatedFields.push("фото");
              resolve();
            });
          });
        }

        if (errors.length > 0) {
          return res
            .status(500)
            .json({ success: false, message: errors.join(", ") });
        }

        res.json({
          success: true,
          message: `Данные успешно обновлены: ${updatedFields.join(", ")}`,
        });
      } catch (error) {
        console.error("Ошибка на сервере:", error);
        res.status(500).json({ success: false, message: "Ошибка на сервере" });
      }
    },
  ];

  async hideDish(req, res) {
    try {
      const { dishId } = req.body;
      if (!dishId) {
        return res
          .status(400)
          .json({ success: false, message: "ID блюда обязателен" });
      }

      // Получаем детали блюда
      const getDishDetailsQuery = `
        SELECT 
          Блюда.ID AS dishId,
          Блюда.ID_категории AS categoryId
        FROM Блюда
        WHERE Блюда.ID = ? 
      `;

      const dishDetails = await new Promise((resolve, reject) => {
        conn.query(getDishDetailsQuery, [dishId], (err, results) => {
          if (err) return reject(err);
          resolve(results[0]);
        });
      });

      if (!dishDetails) {
        return res
          .status(404)
          .json({ success: false, message: "Блюдо не найдено" });
      }

      // Обновляем статус блюда на 2 (скрытое)
      await new Promise((resolve, reject) => {
        conn.query(
          "UPDATE Блюда SET Статус_удаления = 1 WHERE ID = ?",
          [dishId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      // Обновляем статус спецпредложения на 2, если оно связано с этим блюдом
      await new Promise((resolve, reject) => {
        conn.query(
          "UPDATE Спец_предложения SET Статус_удаления = 1 WHERE ID_блюда = ?",
          [dishId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      // Удаляем блюдо из корзины
      await new Promise((resolve, reject) => {
        conn.query(
          "DELETE FROM Блюда_в_корзине WHERE ID_блюда = ?",
          [dishId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      res.status(200).json({
        success: true,
        message: "Блюдо успешно деактивировано",
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false });
    }
  }

  async recoveryDish(req, res) {
    try {
      const { dishId } = req.body;
      if (!dishId) {
        return res
          .status(400)
          .json({ success: false, message: "ID блюда обязателен" });
      }

      // Получаем детали блюда
      const getDishDetailsQuery = `
        SELECT 
          Блюда.ID AS dishId,
          Блюда.ID_категории AS categoryId
        FROM Блюда
        WHERE Блюда.ID = ? 
      `;

      const dishDetails = await new Promise((resolve, reject) => {
        conn.query(getDishDetailsQuery, [dishId], (err, results) => {
          if (err) return reject(err);
          resolve(results[0]);
        });
      });

      if (!dishDetails) {
        return res
          .status(404)
          .json({ success: false, message: "Блюдо не найдено" });
      }

      const { categoryId } = dishDetails;

      // Проверяем статус категории
      const categoryStatus = await new Promise((resolve, reject) => {
        conn.query(
          "SELECT Статус_удаления FROM Категория_блюда WHERE ID = ?",
          [categoryId],
          (err, results) => {
            if (err) return reject(err);
            resolve(results[0]?.Статус_удаления ?? null);
          }
        );
      });

      // Если категория найдена и статус = 2, меняем её на активную
      if (categoryStatus === 2) {
        await new Promise((resolve, reject) => {
          conn.query(
            "UPDATE Категория_блюда SET Статус_удаления = 0 WHERE ID = ?",
            [categoryId],
            (err) => (err ? reject(err) : resolve())
          );
        });
      } else if (categoryStatus !== 1) {
        return res.status(400).json({
          success: false,
          message: "Некорректный статус категории или категория не найдена",
        });
      }

      // Обновляем статус блюда
      await new Promise((resolve, reject) => {
        conn.query(
          "UPDATE Блюда SET Статус_удаления = 0 WHERE ID = ?",
          [dishId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      // Обновляем статус спецпредложений
      await new Promise((resolve, reject) => {
        conn.query(
          "UPDATE Спец_предложения SET Статус_удаления = 0 WHERE ID_блюда = ?",
          [dishId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      res.status(200).json({
        success: true,
        message: "Блюдо успешно восстановлено",
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false });
    }
  }

  async removeDish(req, res) {
    try {
      const { dishId } = req.body;
      if (!dishId) {
        return res
          .status(400)
          .json({ success: false, message: "ID блюда обязателен" });
      }

      // Получаем детали блюда
      const getDishDetailsQuery = `
        SELECT 
          Блюда.ID AS dishId,
          Блюда.ID_категории AS categoryId
        FROM Блюда
        WHERE Блюда.ID = ? 
      `;

      const dishDetails = await new Promise((resolve, reject) => {
        conn.query(getDishDetailsQuery, [dishId], (err, results) => {
          if (err) return reject(err);
          resolve(results[0]);
        });
      });

      if (!dishDetails) {
        return res
          .status(404)
          .json({ success: false, message: "Блюдо не найдено" });
      }

      // Удаляем блюдо из других таблиц
      await new Promise((resolve, reject) => {
        conn.query(
          "DELETE FROM Прайс_лист WHERE ID_блюда = ?",
          [dishId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      await new Promise((resolve, reject) => {
        conn.query(
          `DELETE FROM Спец_предложения WHERE ID_блюда = ?`,
          [dishId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      // Удаляем само блюдо
      await new Promise((resolve, reject) => {
        conn.query("DELETE FROM Блюда WHERE ID = ?", [dishId], (err) =>
          err ? reject(err) : resolve()
        );
      });

      res.status(200).json({ success: true, message: "Блюдо успешно удалено" });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false });
    }
  }

  async getCategories(req, res) {
    try {
      // SQL-запрос для получения всех столов
      const query = `SELECT ID, Наименование FROM Категория_блюда WHERE Статус_удаления = 0`;

      conn.query(query, (err, results) => {
        if (err) {
          console.error("Ошибка при получении категорий:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при получении категорий",
          });
        }

        res.status(200).json({
          success: true,
          categories: results,
        });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({
        success: false,
        message: "Произошла ошибка на сервере",
      });
    }
  }

  async removeCategory(req, res) {
    try {
      const { categoryId } = req.body;
      if (!categoryId) {
        return res
          .status(400)
          .json({ success: false, message: "ID категории обязателен" });
      }

      // Получаем все блюда, принадлежащие категории
      const getDishesQuery = `
        SELECT ID FROM Блюда WHERE ID_категории = ?
      `;

      const dishes = await new Promise((resolve, reject) => {
        conn.query(getDishesQuery, [categoryId], (err, results) => {
          if (err) return reject(err);
          resolve(results.map((row) => row.ID)); // массив ID блюд
        });
      });

      if (dishes.length > 0) {
        // Удаляем блюда из всех связанных таблиц
        const deleteFromTables = async (table, column) => {
          await new Promise((resolve, reject) => {
            conn.query(
              `DELETE FROM ${table} WHERE ${column} IN (?)`,
              [dishes],
              (err) => (err ? reject(err) : resolve())
            );
          });
        };

        await deleteFromTables("Прайс_лист", "ID_блюда");
        await deleteFromTables("Спец_предложения", "ID_блюда");

        // Удаляем сами блюда
        await new Promise((resolve, reject) => {
          conn.query("DELETE FROM Блюда WHERE ID IN (?)", [dishes], (err) =>
            err ? reject(err) : resolve()
          );
        });
      }

      // Удаляем категорию
      await new Promise((resolve, reject) => {
        conn.query(
          "DELETE FROM Категория_блюда WHERE ID = ?",
          [categoryId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      res.status(200).json({
        success: true,
        message: "Категория и все связанные блюда удалены",
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  async hideCategory(req, res) {
    try {
      const { categoryId } = req.body;
      if (!categoryId) {
        return res
          .status(400)
          .json({ success: false, message: "ID категории обязателен" });
      }

      // Получаем все блюда, принадлежащие категории
      const getDishesQuery = `
        SELECT ID FROM Блюда WHERE ID_категории = ?
      `;

      const dishes = await new Promise((resolve, reject) => {
        conn.query(getDishesQuery, [categoryId], (err, results) => {
          if (err) return reject(err);
          resolve(results.map((row) => row.ID)); // массив ID блюд
        });
      });

      if (dishes.length > 0) {
        // Обновляем статус всех блюд на 2 (скрытые)
        await new Promise((resolve, reject) => {
          conn.query(
            "UPDATE Блюда SET Статус_удаления = 1 WHERE ID IN (?)",
            [dishes],
            (err) => (err ? reject(err) : resolve())
          );
        });

        // Обновляем статус спецпредложений на 2
        await new Promise((resolve, reject) => {
          conn.query(
            "UPDATE Спец_предложения SET Статус_удаления = 1 WHERE ID_блюда IN (?)",
            [dishes],
            (err) => (err ? reject(err) : resolve())
          );
        });

        // Удаляем блюда из корзины
        await new Promise((resolve, reject) => {
          conn.query(
            "DELETE FROM Блюда_в_корзине WHERE ID_блюда IN (?)",
            [dishes],
            (err) => (err ? reject(err) : resolve())
          );
        });
      }

      // Обновляем статус категории на 2 (скрытая)
      await new Promise((resolve, reject) => {
        conn.query(
          "UPDATE Категория_блюда SET Статус_удаления = 1 WHERE ID = ?",
          [categoryId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      res.status(200).json({
        success: true,
        message: "Категория и все связанные блюда успешно скрыты",
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  async recoveryCategory(req, res) {
    try {
      const { categoryId } = req.body;
      if (!categoryId) {
        return res
          .status(400)
          .json({ success: false, message: "ID категории обязателен" });
      }

      // Обновляем статус категории на 1 (не скрытая)
      await new Promise((resolve, reject) => {
        conn.query(
          "UPDATE Категория_блюда SET Статус_удаления = 0 WHERE ID = ?",
          [categoryId],
          (err) => (err ? reject(err) : resolve())
        );
      });

      res.status(200).json({
        success: true,
        message: "Категория восстановлена",
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  async updateCategory(req, res) {
    console.log("Полученные данные:", req.body);
    const { categoryId, name } = req.body;

    if (!categoryId || !name) {
      return res.status(400).json({
        success: false,
        message: "Заполните поле",
      });
    }

    try {
      const query = `
        UPDATE Категория_блюда 
        SET Наименование = ? 
        WHERE ID = ?
      `;

      conn.query(query, [name, categoryId], (err, result) => {
        if (err) {
          console.error("Ошибка при обновлении категории:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при обновлении категории",
          });
        }
        res.json({ success: true, message: "Категория обновлена" });
      });
    } catch (error) {
      console.error("Ошибка при обновлении категории:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  async addDish(req, res) {
    // Обрабатываем загрузку изображения
    upload.single("image")(req, res, async (err) => {
      if (err) {
        console.error("Ошибка при загрузке изображения:", err);
        return res.status(500).json({
          success: false,
          message: "Ошибка при загрузке изображения",
        });
      }

      const { name, price, category } = req.body;
      const image = req.file;

      if (!name || !price || !category || !image) {
        return res.status(400).json({
          success: false,
          message: "Не указаны обязательные данные",
        });
      }

      // Проверяем, что категория — это число
      const categoryId = parseInt(category, 10);
      if (isNaN(categoryId)) {
        return res.status(400).json({
          success: false,
          message: "ID категории должен быть числом",
        });
      }

      let updatedFields = [];
      let errors = [];

      try {
        // Добавление блюда
        const photoPath = `/images/${image.filename}`; // Путь к загруженному изображению
        const insertDishQuery = `
          INSERT INTO Блюда (ID_категории, Название, Фото)
          VALUES (?, ?, ?)
        `;

        const dishId = await new Promise((resolve, reject) => {
          conn.query(
            insertDishQuery,
            [categoryId, name, photoPath],
            (err, result) => {
              if (err) {
                errors.push("Ошибка при добавлении блюда");
                return reject(err);
              }
              updatedFields.push("блюдо");
              resolve(result.insertId);
            }
          );
        });

        // Добавление цены
        const insertPriceQuery = `
          INSERT INTO Прайс_лист (ID_блюда, Цена, Дата)
          VALUES (?, ?, CURDATE())
        `;

        await new Promise((resolve, reject) => {
          conn.query(insertPriceQuery, [dishId, price], (err, result) => {
            if (err) {
              errors.push("Ошибка при добавлении цены блюда");
              return reject(err);
            }
            updatedFields.push("цена");
            resolve();
          });
        });

        if (errors.length > 0) {
          return res.status(500).json({
            success: false,
            message: errors.join(", "),
          });
        }

        res.status(201).json({
          success: true,
          message: `Данные успешно добавлены: ${updatedFields.join(", ")}`,
        });
      } catch (error) {
        console.error("Ошибка на сервере:", error);
        res.status(500).json({
          success: false,
          message: "Ошибка на сервере",
        });
      }
    });
  }

  async addCategory(req, res) {
    const { name } = req.body;

    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Данные не указаны" });
    }

    try {
      const query = `
        INSERT INTO Категория_блюда (Наименование) 
        VALUES (?)
      `;
      conn.query(query, [name], (err, result) => {
        if (err) {
          console.error("Ошибка при создании категории:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при создании категории",
          });
        }
        res.json({ success: true, message: "Новая категория создана" });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  async getAllOffers(req, res) {
    try {
      const query = `
            SELECT 
              Спец_предложения.ID, 
              Спец_предложения.Описание, 
              Спец_предложения.Дата_начала, 
              Спец_предложения.Дата_окончания, 
              Спец_предложения.Размер_скидки, 
              Блюда.Название AS Название_блюда
            FROM 
              Спец_предложения
            JOIN 
              Блюда ON Спец_предложения.ID_блюда = Блюда.ID
            WHERE 
              Спец_предложения.Дата_окончания >= CURRENT_DATE AND 
              Спец_предложения.Статус_удаления = 0
          `;

      conn.query(query, (err, results) => {
        if (err) {
          console.error("Ошибка при получении предложений:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при получении предложений",
          });
        }
        res.json({ success: true, data: results });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  async getHideOffers(req, res) {
    try {
      const query = `
            SELECT 
              Спец_предложения.ID, 
              Спец_предложения.Описание, 
              Спец_предложения.Дата_начала, 
              Спец_предложения.Дата_окончания, 
              Спец_предложения.Размер_скидки, 
              Блюда.Название AS Название_блюда
            FROM 
              Спец_предложения
            JOIN 
              Блюда ON Спец_предложения.ID_блюда = Блюда.ID
            WHERE 
              Спец_предложения.Дата_окончания >= CURRENT_DATE AND 
              Спец_предложения.Статус_удаления = 1
          `;

      conn.query(query, (err, results) => {
        if (err) {
          console.error("Ошибка при получении предложений:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при получении предложений",
          });
        }
        res.json({ success: true, data: results });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  // Скрытие спецпредложения
  async hideOffer(req, res) {
    const { id } = req.body; // Получение ID из тела запроса

    if (!id) {
      return res.status(400).json({ success: false, message: "ID не указан" });
    }

    try {
      const query = `
          UPDATE Спец_предложения SET Статус_удаления = 1
          WHERE ID = ?
        `;
      conn.query(query, [id], (err, result) => {
        if (err) {
          console.error("Ошибка при скрытии предложения:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при скрытии предложения",
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: "Спецпредложение с указанным ID не найдено",
          });
        }

        res.json({
          success: true,
          message: "Спецпредложение успешно скрыто",
        });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  async recoveryOffer(req, res) {
    const { id } = req.body; // Получение ID из тела запроса

    if (!id) {
      return res.status(400).json({ success: false, message: "ID не указан" });
    }

    try {
      const query = `
          UPDATE Спец_предложения SET Статус_удаления = 0
          WHERE ID = ?
        `;
      conn.query(query, [id], (err, result) => {
        if (err) {
          console.error("Ошибка при восстановлении предложения:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при восстановлении предложения",
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: "Спецпредложение с указанным ID не найдено",
          });
        }

        res.json({
          success: true,
          message: "Спецпредложение успешно восстановлено",
        });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  // Удаление спецпредложения
  async deleteOffer(req, res) {
    const { id } = req.body; // Получение ID из тела запроса

    if (!id) {
      return res.status(400).json({ success: false, message: "ID не указан" });
    }

    try {
      const query = `
          DELETE FROM Спец_предложения
          WHERE ID = ?
        `;
      conn.query(query, [id], (err, result) => {
        if (err) {
          console.error("Ошибка при удалении предложения:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при удалении предложения",
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: "Спецпредложение с указанным ID не найдено",
          });
        }

        res.json({
          success: true,
          message: "Спецпредложение успешно удалено",
        });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  // Создание нового спецпредложения
  async createOffer(req, res) {
    const { dish, description, startDate, endDate, discount } = req.body;

    if (!dish || !description || !startDate || !endDate || !discount) {
      return res
        .status(400)
        .json({ success: false, message: "Данные не указаны" });
    }

    try {
      const query = `
        INSERT INTO Спец_предложения (ID_блюда, Описание, Дата_начала, Дата_окончания, Размер_скидки) 
        VALUES (?, ?, ?, ?, ?)
      `;
      conn.query(
        query,
        [dish, description, startDate, endDate, discount],
        (err, result) => {
          if (err) {
            console.error("Ошибка при создании предложения:", err);
            return res.status(500).json({
              success: false,
              message: "Ошибка при создании предложения",
            });
          }
          res.json({ success: true, message: "Новое предложение создано" });
        }
      );
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  async activeDish(req, res) {
    try {
      const query = `
      SELECT 
        Блюда.ID, 
        Блюда.Название
      FROM 
        Блюда
      WHERE 
        Блюда.ID NOT IN (
          SELECT 
            Спец_предложения.ID_блюда
          FROM 
            Спец_предложения
          WHERE 
            Спец_предложения.Дата_окончания >= CURRENT_DATE
            AND Спец_предложения.Статус_удаления = 0
        )
    `;

      conn.query(query, (err, results) => {
        if (err) {
          console.error("Ошибка при получении доступных блюд:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при получении доступных блюд",
          });
        }

        return res.status(200).json({ success: true, dishes: results });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      return res
        .status(500)
        .json({ success: false, message: "Произошла ошибка на сервере" });
    }
  }

  async getAllReview(req, res) {
    try {
      const query = `
        SELECT 
          Отзыв.ID, 
          Отзыв.Оценка, 
          Отзыв.Текст_отзыва, 
          Отзыв.Дата, 
          Пользователь.Имя AS Имя_пользователя
        FROM 
          Отзыв
        JOIN 
          Пользователь ON Отзыв.ID_пользователя = Пользователь.ID
          ORDER BY Отзыв.Дата DESC
      `;
      conn.query(query, (err, results) => {
        if (err) {
          console.error("Ошибка при получении отзывов:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при получении отзывов",
          });
        }
        res.json({ success: true, data: results });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }

  async deleteReview(req, res) {
    const { id } = req.body; // Получение ID из тела запроса

    if (!id) {
      return res.status(400).json({ success: false, message: "ID не указан" });
    }

    try {
      const query = `
          DELETE FROM Отзыв
          WHERE ID = ?
        `;
      conn.query(query, [id], (err, result) => {
        if (err) {
          console.error("Ошибка при удалении отзыва:", err);
          return res.status(500).json({
            success: false,
            message: "Ошибка при удалении отзыва",
          });
        }

        if (result.affectedRows === 0) {
          return res.status(404).json({
            success: false,
            message: "Отзыв с указанным ID не найден",
          });
        }

        res.json({
          success: true,
          message: "Отзыв успешно удален",
        });
      });
    } catch (error) {
      console.error("Ошибка на сервере:", error);
      res.status(500).json({ success: false, message: "Ошибка на сервере" });
    }
  }
}

module.exports = new ContmanController();
